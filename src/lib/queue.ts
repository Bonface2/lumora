import { Queue } from "bullmq";
import IORedis from "ioredis";

// ─── System-wide constants ────────────────────────────────────────────────────

export const RESALE_REVOKE_DAYS_BEFORE_EVENT = 3;

// ─── Queue Names ──────────────────────────────────────────────────────────────

export const QUEUES = {
  INSTALLMENT_REMINDER: "installment-reminder",
  DEFAULT_WARNING: "default-warning",
  TICKET_REVOCATION: "ticket-revocation",
  RESALE_EXPIRY: "resale-expiry",
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

export interface ResaleExpiryJob {
  resaleListingId: string;
}

// ─── Lazy singletons ──────────────────────────────────────────────────────────

let _connection: IORedis | null = null;
let _installmentReminderQueue: Queue | null = null;
let _defaultWarningQueue: Queue | null = null;
let _ticketRevocationQueue: Queue | null = null;
let _resaleExpiryQueue: Queue | null = null;

function getConnection(): IORedis {
  if (!_connection) {
    _connection = new IORedis(
      process.env.REDIS_URL ?? "redis://localhost:6379",
      { maxRetriesPerRequest: null }
    );
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

function getResaleExpiryQueue(): Queue {
  if (!_resaleExpiryQueue) {
    _resaleExpiryQueue = new Queue(QUEUES.RESALE_EXPIRY, {
      connection: getConnection(),
    });
  }
  return _resaleExpiryQueue;
}

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
export async function scheduleDefaultWarnings(
  installmentPaymentId: string,
  orderId: string,
  dueDate: Date,
  gracePeriodDays: number
) {
  const queue = getDefaultWarningQueue();
  const now = Date.now();

  for (let dayAfterDue = 1; dayAfterDue <= gracePeriodDays; dayAfterDue++) {
    const fireAt = new Date(dueDate);
    fireAt.setDate(fireAt.getDate() + dayAfterDue);
    const delay = fireAt.getTime() - now;
    if (delay <= 0) continue;

    const daysUntilRevocation = gracePeriodDays - dayAfterDue;
    await queue.add(
      "send-default-warning",
      { installmentPaymentId, orderId, daysUntilRevocation } satisfies DefaultWarningJob,
      { delay, jobId: `default-warning-${installmentPaymentId}-d${dayAfterDue}`, removeOnComplete: true }
    );
  }
}

export async function scheduleTicketRevocation(
  orderId: string,
  installmentPaymentId: string,
  dueDate: Date,
  gracePeriodDays: number
) {
  const revocationDate = new Date(dueDate);
  revocationDate.setDate(revocationDate.getDate() + gracePeriodDays);
  const delay = revocationDate.getTime() - Date.now();
  if (delay <= 0) return;

  await getTicketRevocationQueue().add(
    "revoke-ticket",
    { orderId, installmentPaymentId } satisfies TicketRevocationJob,
    { delay, jobId: `revoke-${installmentPaymentId}`, removeOnComplete: true }
  );
}

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

export { getConnection as connection };
