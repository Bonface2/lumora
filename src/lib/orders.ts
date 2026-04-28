import { db } from "@/lib/db";
import {
  cancelInstallmentJobs,
  scheduleInstallmentReminder,
  scheduleTicketRevocation,
} from "@/lib/queue";

// ─── Balance Helpers ──────────────────────────────────────────────────────────

export function getRemainingBalance(
  totalAmount: number,
  paidAmount: number
): number {
  return Math.max(0, totalAmount - paidAmount);
}

// ─── Pay Balance in Full ──────────────────────────────────────────────────────

/**
 * Called after Paystack confirms a "pay in full" transaction.
 * Marks all outstanding installments as paid and promotes the order to
 * PAID_IN_FULL, then cancels any queued reminders and revocation jobs.
 */
export async function payBalanceInFull(orderId: string): Promise<void> {
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { payments: true },
  });

  if (order.status === "PAID_IN_FULL" || order.status === "REVOKED") {
    throw new Error(`Order ${orderId} is already ${order.status}`);
  }

  const unpaidIds = order.payments
    .filter((p) => p.status === "PENDING" || p.status === "OVERDUE")
    .map((p) => p.id);

  await db.$transaction([
    db.installmentPayment.updateMany({
      where: { id: { in: unpaidIds } },
      data: { status: "PAID", paidAt: new Date() },
    }),
    db.order.update({
      where: { id: orderId },
      data: {
        status: "PAID_IN_FULL",
        paidAmount: order.totalAmount,
      },
    }),
  ]);

  await cancelInstallmentJobs(unpaidIds);
}

// ─── Resale Ownership Transfer ────────────────────────────────────────────────

/**
 * Transfers an order (and its remaining installment obligations) to a new buyer.
 * Called after the resale purchase payment is confirmed.
 *
 * - Updates order.buyerId to the new buyer.
 * - Stamps originalBuyerId once (preserves the chain if the ticket is resold again).
 * - Updates currentOwnerId on all tickets in the order.
 * - Re-schedules reminder and revocation jobs so emails target the new buyer.
 */
export async function transferOrderOwnership(
  orderId: string,
  newBuyerId: string,
  gracePeriodDays: number
): Promise<void> {
  const order = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      payments: true,
      tickets: true,
      ticketCategory: { include: { installmentPlan: true } },
    },
  });

  const previousBuyerId = order.buyerId;

  await db.$transaction([
    db.order.update({
      where: { id: orderId },
      data: {
        buyerId: newBuyerId,
        // Only stamp originalBuyerId the first time it transfers
        originalBuyerId: order.originalBuyerId ?? previousBuyerId,
      },
    }),
    db.ticket.updateMany({
      where: { orderId },
      data: { currentOwnerId: newBuyerId },
    }),
  ]);

  // Cancel jobs aimed at the previous buyer, then re-queue for the new one.
  // The schedule stays the same; only the recipient changes (workers resolve
  // the buyer from order.buyerId at run time).
  const pendingPayments = order.payments.filter(
    (p) => p.status === "PENDING" || p.status === "OVERDUE"
  );

  const pendingIds = pendingPayments.map((p) => p.id);
  await cancelInstallmentJobs(pendingIds);

  for (const payment of pendingPayments) {
    await scheduleInstallmentReminder(payment.id, orderId, payment.dueDate);
    await scheduleTicketRevocation(
      orderId,
      payment.id,
      payment.dueDate,
      gracePeriodDays
    );
  }
}
