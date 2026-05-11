import { Worker } from "bullmq";
import { db } from "@/lib/db";
import { sendSellerDefaultAlert, sendSellerPreRevocationAlert } from "@/lib/email";
import { connection, QUEUES, type SellerAlertJob } from "@/lib/queue";

const worker = new Worker<SellerAlertJob>(
  QUEUES.SELLER_ALERT,
  async (job) => {
    const { orderId, alertType } = job.data;

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: { select: { name: true, email: true } },
        ticketCategory: {
          include: {
            event: {
              include: {
                seller: { select: { name: true, email: true } },
              },
            },
          },
        },
        payments: {
          where: { paymentNumber: { gt: 0 }, status: { in: ["PENDING", "OVERDUE", "DEFAULTED"] } },
          orderBy: { dueDate: "asc" },
        },
      },
    });

    if (!order) return;
    if (order.status === "PAID_IN_FULL" || order.status === "REVOKED" || order.status === "CANCELLED") return;

    const { buyer, ticketCategory } = order;
    const { event } = ticketCategory;
    const seller = event.seller;

    const overduePayment = order.payments[0];
    const overdueAmount = overduePayment
      ? `KES ${(Number(overduePayment.amount) - Number(overduePayment.paidAmount)).toLocaleString()}`
      : "Unknown";

    const defaultersUrl = `${process.env.NEXT_PUBLIC_APP_URL}/seller/defaulters`;

    const shared = {
      to: seller.email,
      sellerName: seller.name ?? "there",
      buyerName: buyer.name ?? buyer.email,
      eventTitle: event.title,
      categoryName: ticketCategory.name,
      overdueAmount,
      defaultersUrl,
    };

    if (alertType === "defaulted") {
      await sendSellerDefaultAlert(shared);
    } else {
      await sendSellerPreRevocationAlert(shared);
    }
  },
  { connection: connection() }
);

worker.on("failed", (job, err) => {
  console.error(`Seller alert job ${job?.id} failed:`, err.message);
});

export default worker;
