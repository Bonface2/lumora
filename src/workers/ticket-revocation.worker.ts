import { Worker } from "bullmq";
import { db } from "@/lib/db";
import { sendTicketRevocationNotice } from "@/lib/email";
import { connection, QUEUES, type TicketRevocationJob } from "@/lib/queue";

const worker = new Worker<TicketRevocationJob>(
  QUEUES.TICKET_REVOCATION,
  async (job) => {
    const { orderId, installmentPaymentId } = job.data;

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: true,
        tickets: true,
        ticketCategory: { include: { event: true } },
        payments: true,
      },
    });

    if (!order) return;
    if (order.status === "PAID_IN_FULL" || order.status === "REVOKED") return;

    const payment = order.payments.find((p) => p.id === installmentPaymentId);
    if (!payment || payment.status === "PAID") return;

    await db.$transaction([
      // Mark all unpaid installments as DEFAULTED
      db.installmentPayment.updateMany({
        where: { orderId, status: { in: ["PENDING", "OVERDUE"] } },
        data: { status: "DEFAULTED" },
      }),
      // Revoke all tickets on the order
      db.ticket.updateMany({
        where: { orderId },
        data: { status: "REVOKED" },
      }),
      // Mark the order as REVOKED
      db.order.update({
        where: { id: orderId },
        data: { status: "REVOKED" },
      }),
    ]);

    await sendTicketRevocationNotice({
      to: order.buyer.email,
      name: order.buyer.name ?? "there",
      eventTitle: order.ticketCategory.event.title,
      reason: "Payment not received by the due date.",
    });
  },
  { connection }
);

worker.on("failed", (job, err) => {
  console.error(`Revocation job ${job?.id} failed:`, err.message);
});

export default worker;
