import { Worker } from "bullmq";
import { db } from "@/lib/db";
import { sendDefaultWarning } from "@/lib/email";
import { connection, QUEUES, type DefaultWarningJob } from "@/lib/queue";

const worker = new Worker<DefaultWarningJob>(
  QUEUES.DEFAULT_WARNING,
  async (job) => {
    const { installmentPaymentId, orderId, daysUntilRevocation } = job.data;

    const payment = await db.installmentPayment.findUnique({
      where: { id: installmentPaymentId },
      include: {
        order: {
          include: {
            buyer: true,
            ticketCategory: { include: { event: true } },
          },
        },
      },
    });

    if (!payment || payment.status !== "PENDING") return;

    const { buyer, ticketCategory } = payment.order;
    const event = ticketCategory.event;

    await sendDefaultWarning({
      to: buyer.email,
      name: buyer.name ?? "there",
      eventTitle: event.title,
      amount: `KES ${(Number(payment.amount) - Number(payment.paidAmount)).toLocaleString()}`,
      daysUntilRevocation,
      paymentUrl: `${process.env.NEXT_PUBLIC_APP_URL}/buyer/orders/${orderId}/pay`,
    });
  },
  { connection: connection() }
);

worker.on("failed", (job, err) => {
  console.error(`Default warning job ${job?.id} failed:`, err.message);
});

export default worker;
