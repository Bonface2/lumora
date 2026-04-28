import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(
  process.env.REDIS_URL ?? "redis://localhost:6379",
  { maxRetriesPerRequest: null }
);

// ─── Queue Names ──────────────────────────────────────────────────────────────

export const QUEUES = {
  INSTALLMENT_REMINDER: "installment-reminder",
  TICKET_REVOCATION: "ticket-revocation",
  RESALE_EXPIRY: "resale-expiry",
} as const;

// ─── Queues ───────────────────────────────────────────────────────────────────

export const installmentReminderQueue = new Queue(
  QUEUES.INSTALLMENT_REMINDER,
  { connection }
);

export const ticketRevocationQueue = new Queue(QUEUES.TICKET_REVOCATION, {
  connection,
});

export const resaleExpiryQueue = new Queue(QUEUES.RESALE_EXPIRY, {
  connection,
});

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

// ─── Schedule Helpers ─────────────────────────────────────────────────────────

export async function scheduleInstallmentReminder(
  installmentPaymentId: string,
  orderId: string,
  dueDate: Date
) {
  const reminderDate = new Date(dueDate);
  reminderDate.setDate(reminderDate.getDate() - 3);
  const delay = reminderDate.getTime() - Date.now();
  if (delay <= 0) return;

  await installmentReminderQueue.add(
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

  await ticketRevocationQueue.add(
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

  await resaleExpiryQueue.add(
    "expire-listing",
    { resaleListingId } satisfies ResaleExpiryJob,
    {
      delay,
      jobId: `resale-expiry-${resaleListingId}`,
      removeOnComplete: true,
    }
  );
}

/**
 * Cancel all scheduled reminder and revocation jobs for a set of installment
 * payment IDs. Called when a buyer pays their balance in full or when an order
 * is transferred to a new owner.
 */
export async function cancelInstallmentJobs(
  installmentPaymentIds: string[]
): Promise<void> {
  for (const id of installmentPaymentIds) {
    const reminderJob = await installmentReminderQueue.getJob(`reminder-${id}`);
    await reminderJob?.remove();

    const revocationJob = await ticketRevocationQueue.getJob(`revoke-${id}`);
    await revocationJob?.remove();
  }
}

// ─── Expiry Date Helpers ──────────────────────────────────────────────────────

/**
 * Compute the correct expiry date for a resale listing.
 *
 * - Fully-paid tickets: expires when the event ends (no urgency, buyer owns it outright).
 * - Partially-paid tickets: expires revokeBeforeEventDays before the event so
 *   the ticket can be reclaimed if it remains unsold.
 */
export function computeResaleExpiry(
  isFullyPaid: boolean,
  eventDate: Date,
  eventEndDate: Date | null,
  revokeBeforeEventDays: number
): Date {
  if (isFullyPaid) {
    return eventEndDate ?? eventDate;
  }

  const expiry = new Date(eventDate);
  expiry.setDate(expiry.getDate() - revokeBeforeEventDays);
  return expiry;
}

export { connection };
