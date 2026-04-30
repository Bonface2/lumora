import { Worker } from "bullmq";
import { format } from "date-fns";
import { db } from "@/lib/db";
import { sendInstallmentReminder } from "@/lib/email";
import { connection, QUEUES, type InstallmentReminderJob } from "@/lib/queue";

const worker = new Worker<InstallmentReminderJob>(
  QUEUES.INSTALLMENT_REMINDER,
  async (job) => {
    const { installmentPaymentId, orderId } = job.data;

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

    await sendInstallmentReminder({
      to: buyer.email,
      name: buyer.name ?? "there",
      eventTitle: event.title,
      amount: `KES ${Number(payment.amount).toLocaleString()}`,
      dueDate: format(payment.dueDate, "dd MMM yyyy"),
      paymentUrl: `${process.env.NEXT_PUBLIC_APP_URL}/buyer/orders/${orderId}/pay/${installmentPaymentId}`,
    });

    await db.installmentPayment.update({
      where: { id: installmentPaymentId },
      data: { reminderSentAt: new Date() },
    });
  },
  { connection: connection() }
);

worker.on("failed", (job, err) => {
  console.error(`Reminder job ${job?.id} failed:`, err.message);
});

export default worker;
