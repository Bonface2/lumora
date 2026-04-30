import { Queue } from "bullmq";
import IORedis from "ioredis";

// ─── System-wide constants ────────────────────────────────────────────────────

export const RESALE_REVOKE_DAYS_BEFORE_EVENT = 3;

// ─── Queue Names ──────────────────────────────────────────────────────────────

export const QUEUES = {
  INSTALLMENT_REMINDER: "installment-reminder",
  TICKET_REVOCATION: "ticket-revocation",
  RESALE_EXPIRY: "resale-expiry",
} as const;

// ─── Job Payload Types ────────────────────────────────────────────────────────

export interface InstallmentReminderJob {
  installmentPaymentId: string;
  orderId: string;
}

export interface TicketRevocationJob {
  orderId: string;
  installmentPaymentId: string;
}

export interface ResaleExpiryJob {
  resaleListingId: string;
}

// ─── Lazy singletons — connection and queues are only created on first use ───
// This prevents module-level IORedis connections from crashing serverless
// environments (e.g. Vercel) where Redis is not available at import time.

let _connection: IORedis | null = null;
let _installmentReminderQueue: Queue | null = null;
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

export async function scheduleInstallmentReminder(
  installmentPaymentId: string,
  orderId: string,
  dueDate: Date
) {
  const reminderDate = new Date(dueDate);
  reminderDate.setDate(reminderDate.getDate() - 3);
  const delay = Math.max(0, reminderDate.getTime() - Date.now());

  await getInstallmentReminderQueue().add(
    "send-reminder",
    { installmentPaymentId, orderId } satisfies InstallmentReminderJob,
    { delay, jobId: `reminder-${installmentPaymentId}`, removeOnComplete: true }
  );
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
    {
      delay,
      jobId: `revoke-${installmentPaymentId}`,
      removeOnComplete: true,
    }
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
    {
      delay,
      jobId: `resale-expiry-${resaleListingId}`,
      removeOnComplete: true,
    }
  );
}

export async function cancelInstallmentJobs(
  installmentPaymentIds: string[]
): Promise<void> {
  const reminderQ = getInstallmentReminderQueue();
  const revocationQ = getTicketRevocationQueue();

  for (const id of installmentPaymentIds) {
    const reminderJob = await reminderQ.getJob(`reminder-${id}`);
    await reminderJob?.remove();

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
