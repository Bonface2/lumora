import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { sendTicketConfirmation, sendInstallmentReceipt } from "@/lib/email";
import {
  scheduleInstallmentReminder,
  scheduleTicketRevocation,
} from "@/lib/queue";
import { format } from "date-fns";

function generateTicketNumber(prefix: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const random = Array.from({ length: 8 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");
  return `${prefix}-${random}`;
}

export async function POST(req: Request) {
  console.log("[webhook] POST received at", new Date().toISOString());
  const body = await req.text();

  // Verify Paystack signature
  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!)
    .update(body)
    .digest("hex");

  if (hash !== req.headers.get("x-paystack-signature")) {
    console.log("[webhook] Invalid signature — check PAYSTACK_SECRET_KEY");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(body);
  console.log("[webhook] Event type:", event.event);
  if (event.event !== "charge.success") {
    return NextResponse.json({ received: true });
  }

  const { reference, amount } = event.data;
  const amountNaira = amount / 100;

  const transaction = await db.paystackTransaction.findUnique({
    where: { reference },
    include: {
      order: {
        include: {
          buyer: true,
          ticketCategory: {
            include: {
              event: true,
              installmentPlan: { include: { scheduleItems: true } },
            },
          },
          payments: { orderBy: { paymentNumber: "asc" } },
          tickets: true,
        },
      },
    },
  });

  if (!transaction || transaction.status === "success") {
    return NextResponse.json({ received: true });
  }

  const { order } = transaction;
  const { buyer, ticketCategory } = order;
  const event_ = ticketCategory.event;
  const plan = ticketCategory.installmentPlan;

  await db.$transaction(async (tx) => {
    // Mark Paystack transaction as successful
    await tx.paystackTransaction.update({
      where: { reference },
      data: { status: "success", paystackRef: event.data.id?.toString() },
    });

    // Mark the initial installment payment as paid
    const initialPayment = order.payments.find((p) => p.paymentNumber === 0);
    if (initialPayment && initialPayment.status !== "PAID") {
      await tx.installmentPayment.update({
        where: { id: initialPayment.id },
        data: { status: "PAID", paidAt: new Date() },
      });
    }

    const newPaidAmount = Number(order.paidAmount) + amountNaira;
    const isFullyPaid = newPaidAmount >= Number(order.totalAmount) - 0.01;

    // Update order status
    await tx.order.update({
      where: { id: order.id },
      data: {
        paidAmount: newPaidAmount,
        status: isFullyPaid ? "PAID_IN_FULL" : "PARTIAL_PAID",
      },
    });

    // Increment soldQuantity on the category
    await tx.ticketCategory.update({
      where: { id: ticketCategory.id },
      data: { soldQuantity: { increment: order.quantity } },
    });

    // Generate one ticket per quantity if not already created
    if (order.tickets.length === 0) {
      const prefix = event_.title
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 4);

      for (let i = 0; i < order.quantity; i++) {
        await tx.ticket.create({
          data: {
            orderId: order.id,
            ticketCategoryId: ticketCategory.id,
            ticketNumber: generateTicketNumber(prefix),
            status: "ACTIVE",
            currentOwnerId: buyer.id,
          },
        });
      }
    }
  });

  // Reload order with fresh ticket
  const updatedOrder = await db.order.findUniqueOrThrow({
    where: { id: order.id },
    include: { tickets: true, payments: true },
  });

  const ticketNumbers = updatedOrder.tickets.map((t) => t.ticketNumber);
  const isFullyPaid = Number(updatedOrder.paidAmount) >= Number(updatedOrder.totalAmount) - 0.01;

  // Send email — non-blocking; log but don't fail the webhook
  try {
    const eventDate = format(event_.date, "EEEE, dd MMMM yyyy · HH:mm");
    const venue = `${event_.venue}${event_.city ? `, ${event_.city}` : ""}`;

    if (isFullyPaid) {
      await sendTicketConfirmation({
        to: buyer.email,
        name: buyer.name ?? "there",
        eventTitle: event_.title,
        categoryName: ticketCategory.name,
        ticketNumbers,
        eventDate,
        venue,
      });
    } else {
      const remainingPayments = updatedOrder.payments
        .filter((p) => p.paymentNumber > 0 && p.status === "PENDING")
        .map((p) => ({
          installmentNumber: p.paymentNumber,
          amount: Number(p.amount),
          dueDate: format(p.dueDate, "dd MMM yyyy"),
        }));

      await sendInstallmentReceipt({
        to: buyer.email,
        name: buyer.name ?? "there",
        eventTitle: event_.title,
        categoryName: ticketCategory.name,
        eventDate,
        venue,
        amountPaid: amountNaira,
        totalPaid: Number(updatedOrder.paidAmount),
        totalAmount: Number(updatedOrder.totalAmount),
        remainingPayments,
      });
    }
  } catch (err) {
    console.error("[webhook] email threw:", err);
  }

  // Schedule reminder + revocation jobs for remaining installments
  if (!isFullyPaid && plan) {
    const pendingPayments = updatedOrder.payments.filter(
      (p) => p.paymentNumber > 0 && p.status === "PENDING"
    );
    for (const payment of pendingPayments) {
      await scheduleInstallmentReminder(payment.id, order.id, payment.dueDate);
      await scheduleTicketRevocation(
        order.id,
        payment.id,
        payment.dueDate,
        plan.gracePeriodDays
      );
    }
  }

  return NextResponse.json({ received: true });
}
