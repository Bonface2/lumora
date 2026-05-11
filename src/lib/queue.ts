import { Queue } from "bullmq";
import IORedis from "ioredis";

// ─── System-wide constants ────────────────────────────────────────────────────

// RESALE: export const RESALE_REVOKE_DAYS_BEFORE_EVENT = 3;

// ─── Queue Names ──────────────────────────────────────────────────────────────

export const QUEUES = {
  INSTALLMENT_REMINDER: "installment-reminder",
  DEFAULT_WARNING: "default-warning",
  TICKET_REVOCATION: "ticket-revocation",
  SELLER_ALERT: "seller-alert",
  // RESALE: RESALE_EXPIRY: "resale-expiry",
} as const;

// ─── Job Payload Types ────────────────────────────────────────────────────────

export interface InstallmentReminderJob {
  installmentPaymentId: string;
  orderId: string;
  daysUntilDue: number; // 0 = due today, 1–3 = days before due
}

export interface DefaultWarningJob {
  installmentPaymentId: string;
  orderId: string;
  daysUntilRevocation: number;
}

export interface TicketRevocationJob {
  orderId: string;
  installmentPaymentId: string;
}

export interface SellerAlertJob {
  orderId: string;
  alertType: "defaulted" | "pre_revocation";
}

// RESALE: export interface ResaleExpiryJob { resaleListingId: string; }

// ─── Lazy singletons ──────────────────────────────────────────────────────────

let _connection: IORedis | null = null;
let _installmentReminderQueue: Queue | null = null;
let _defaultWarningQueue: Queue | null = null;
let _ticketRevocationQueue: Queue | null = null;
let _sellerAlertQueue: Queue | null = null;
// RESALE: let _resaleExpiryQueue: Queue | null = null;

function getConnection(): IORedis {
  if (!_connection) {
    const url = process.env.REDIS_URL ?? "redis://localhost:6379";
    _connection = new IORedis(url, {
      maxRetriesPerRequest: null,
      ...(url.startsWith("rediss://") && { tls: {} }),
    });
  }
  return _connection;
}

function getInstallmentReminderQueue(): Queue {
  if (!_installmentReminderQueue) {
    _installmentReminderQueue = new Queue(QUEUES.INSTALLMENT_REMINDER, {
      connection: getConnection(),
    });
  }
  return _installmentReminderQueue;
}

function getDefaultWarningQueue(): Queue {
  if (!_defaultWarningQueue) {
    _defaultWarningQueue = new Queue(QUEUES.DEFAULT_WARNING, {
      connection: getConnection(),
    });
  }
  return _defaultWarningQueue;
}

function getTicketRevocationQueue(): Queue {
  if (!_ticketRevocationQueue) {
    _ticketRevocationQueue = new Queue(QUEUES.TICKET_REVOCATION, {
      connection: getConnection(),
    });
  }
  return _ticketRevocationQueue;
}

function getSellerAlertQueue(): Queue {
  if (!_sellerAlertQueue) {
    _sellerAlertQueue = new Queue(QUEUES.SELLER_ALERT, {
      connection: getConnection(),
    });
  }
  return _sellerAlertQueue;
}

/* RESALE:
function getResaleExpiryQueue(): Queue {
  if (!_resaleExpiryQueue) {
    _resaleExpiryQueue = new Queue(QUEUES.RESALE_EXPIRY, {
      connection: getConnection(),
    });
  }
  return _resaleExpiryQueue;
}
*/

// ─── Schedule Helpers ─────────────────────────────────────────────────────────

// Schedules daily reminders from t-3 to due date (t-0).
export async function scheduleInstallmentReminder(
  installmentPaymentId: string,
  orderId: string,
  dueDate: Date
) {
  const queue = getInstallmentReminderQueue();
  const now = Date.now();

  for (let daysUntilDue = 3; daysUntilDue >= 0; daysUntilDue--) {
    const fireAt = new Date(dueDate);
    fireAt.setDate(fireAt.getDate() - daysUntilDue);
    const delay = fireAt.getTime() - now;
    if (delay <= 0) continue;

    await queue.add(
      "send-reminder",
      { installmentPaymentId, orderId, daysUntilDue } satisfies InstallmentReminderJob,
      { delay, jobId: `reminder-${installmentPaymentId}-d${daysUntilDue}`, removeOnComplete: true }
    );
  }
}

// Schedules a daily default warning from day 1 after due date until revocation.
// Revocation fires at the earlier of: dueDate + gracePeriodDays, or eventDate − 3 days.
export async function scheduleDefaultWarnings(
  installmentPaymentId: string,
  orderId: string,
  dueDate: Date,
  gracePeriodDays: number,
  eventDate?: Date,
  enforceRevocation = true
) {
  const now = Date.now();
  const sellerQueue = getSellerAlertQueue();

  // Seller "defaulted" alert fires for all plans — seller always needs to know about a miss.
  const defaultedAt = new Date(dueDate);
  defaultedAt.setDate(defaultedAt.getDate() + 1);
  const defaultedDelay = defaultedAt.getTime() - now;
  if (defaultedDelay > 0) {
    await sellerQueue.add(
      "seller-alert",
      { orderId, alertType: "defaulted" } satisfies SellerAlertJob,
      { delay: defaultedDelay, jobId: `seller-alert-defaulted-${orderId}`, removeOnComplete: true }
    );
  }

  // Everything below only applies when auto-revocation is enabled.
  if (!enforceRevocation) return;

  const queue = getDefaultWarningQueue();

  const graceExpiry = new Date(dueDate);
  graceExpiry.setDate(graceExpiry.getDate() + gracePeriodDays);

  const eventCutoff = eventDate
    ? new Date(eventDate.getTime() - 3 * 24 * 60 * 60 * 1000)
    : null;

  const revocationDate =
    eventCutoff && eventCutoff < graceExpiry ? eventCutoff : graceExpiry;

  let dayAfterDue = 1;
  while (true) {
    const fireAt = new Date(dueDate);
    fireAt.setDate(fireAt.getDate() + dayAfterDue);

    if (fireAt >= revocationDate) break;

    const delay = fireAt.getTime() - now;
    if (delay > 0) {
      const msLeft = revocationDate.getTime() - fireAt.getTime();
      const daysUntilRevocation = Math.round(msLeft / (24 * 60 * 60 * 1000));
      await queue.add(
        "send-default-warning",
        { installmentPaymentId, orderId, daysUntilRevocation } satisfies DefaultWarningJob,
        { delay, jobId: `default-warning-${installmentPaymentId}-d${dayAfterDue}`, removeOnComplete: true }
      );
    }
    dayAfterDue++;
  }

  // Seller pre-revocation alert: 1 day before auto-revocation fires.
  const preRevAt = new Date(revocationDate);
  preRevAt.setDate(preRevAt.getDate() - 1);
  const preRevDelay = preRevAt.getTime() - now;
  if (preRevDelay > 0 && preRevAt.getTime() > defaultedAt.getTime()) {
    await sellerQueue.add(
      "seller-alert",
      { orderId, alertType: "pre_revocation" } satisfies SellerAlertJob,
      { delay: preRevDelay, jobId: `seller-alert-prerevocation-${orderId}`, removeOnComplete: true }
    );
  }
}

export async function scheduleTicketRevocation(
  orderId: string,
  installmentPaymentId: string,
  dueDate: Date,
  gracePeriodDays: number,
  eventDate?: Date
) {
  const graceExpiry = new Date(dueDate);
  graceExpiry.setDate(graceExpiry.getDate() + gracePeriodDays);

  // Also revoke 3 days before the event so organisers have a clean list
  const eventCutoff = eventDate ? new Date(eventDate.getTime() - 3 * 24 * 60 * 60 * 1000) : null;

  // Fire at the earlier of the two deadlines
  const revocationDate =
    eventCutoff && eventCutoff < graceExpiry ? eventCutoff : graceExpiry;

  const delay = revocationDate.getTime() - Date.now();
  if (delay <= 0) return;

  await getTicketRevocationQueue().add(
    "revoke-ticket",
    { orderId, installmentPaymentId } satisfies TicketRevocationJob,
    { delay, jobId: `revoke-${installmentPaymentId}`, removeOnComplete: true }
  );
}

/* RESALE:
export async function scheduleResaleExpiry(
  resaleListingId: string,
  expiresAt: Date
) {
  const delay = expiresAt.getTime() - Date.now();
  if (delay <= 0) return;

  await getResaleExpiryQueue().add(
    "expire-listing",
    { resaleListingId } satisfies ResaleExpiryJob,
    { delay, jobId: `resale-expiry-${resaleListingId}`, removeOnComplete: true }
  );
}
*/

export async function cancelInstallmentJobs(
  installmentPaymentIds: string[]
): Promise<void> {
  const reminderQ = getInstallmentReminderQueue();
  const warningQ = getDefaultWarningQueue();
  const revocationQ = getTicketRevocationQueue();

  for (const id of installmentPaymentIds) {
    // Daily reminders t-3 to t-0
    for (let d = 0; d <= 3; d++) {
      const job = await reminderQ.getJob(`reminder-${id}-d${d}`);
      await job?.remove();
    }
    // Legacy single-reminder job (for any pre-existing scheduled jobs)
    const legacyReminder = await reminderQ.getJob(`reminder-${id}`);
    await legacyReminder?.remove();

    // Daily default warnings (cap at 30 days — covers all realistic grace periods)
    for (let d = 1; d <= 30; d++) {
      const job = await warningQ.getJob(`default-warning-${id}-d${d}`);
      await job?.remove();
    }

    const revocationJob = await revocationQ.getJob(`revoke-${id}`);
    await revocationJob?.remove();
  }
}

// ─── Expiry Date Helpers ──────────────────────────────────────────────────────

/* RESALE:
export function computeResaleExpiry(
  isFullyPaid: boolean,
  eventDate: Date,
  eventEndDate: Date | null
): Date {
  if (isFullyPaid) {
    return eventEndDate ?? eventDate;
  }

  const expiry = new Date(eventDate);
  expiry.setDate(expiry.getDate() - RESALE_REVOKE_DAYS_BEFORE_EVENT);
  return expiry;
}
*/

export async function cancelSellerAlertJobs(orderId: string): Promise<void> {
  const queue = getSellerAlertQueue();
  const defaultedJob = await queue.getJob(`seller-alert-defaulted-${orderId}`);
  await defaultedJob?.remove();
  const preRevJob = await queue.getJob(`seller-alert-prerevocation-${orderId}`);
  await preRevJob?.remove();
}

export { getConnection as connection };
