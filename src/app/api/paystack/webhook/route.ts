import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { sendTicketConfirmation, sendInstallmentReceipt, sendCartConfirmation, sendBookingConfirmation } from "@/lib/email";
import {
  scheduleInstallmentReminder,
  scheduleDefaultWarnings,
  scheduleTicketRevocation,
  cancelInstallmentJobs,
} from "@/lib/queue";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

function generateTicketNumber(prefix: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 chars — divides 256 evenly, no modulo bias
  const bytes = crypto.randomBytes(8);
  const random = Array.from(bytes, (b) => chars[b % chars.length]).join("");
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

  // ── Transfer confirmation ─────────────────────────────────────────────────
  if (event.event === "transfer.success" || event.event === "transfer.failed") {
    const { reference, transfer_code } = event.data;
    const status = event.event === "transfer.success" ? "success" : "failed";
    await db.payout.updateMany({
      where: { reference },
      data: { status, paystackRef: transfer_code },
    });
    return NextResponse.json({ received: true });
  }

  if (event.event !== "charge.success") {
    return NextResponse.json({ received: true });
  }

  const { reference, amount } = event.data;
  const amountNaira = amount / 100;

  // Check if this is a platform fee payment (activation or tier upgrade)
  const webhookMeta = event.data.metadata as {
    type?: string;
    eventId?: string;
    tierId?: string;
    tierCap?: number | null;
    tierPrice?: number;
    isUpgrade?: boolean;
  } | null;

  if (webhookMeta?.type === "free_event_fee" && webhookMeta?.eventId) {
    const paidKes = Number(event.data.amount) / 100;
    if (paidKes > 0) {
      const currentEvent = await db.event.findUnique({
        where: { id: webhookMeta.eventId },
        select: { platformFeeAmount: true },
      });
      const previouslyPaid = Number(currentEvent?.platformFeeAmount ?? 0);
      await db.event.update({
        where: { id: webhookMeta.eventId },
        data: {
          platformFeePaid: true,
          attendeeCap: webhookMeta.tierCap ?? null,
          platformFeeAmount: previouslyPaid + paidKes,
        },
      });
    }
    return NextResponse.json({ received: true });
  }

  // Atomic idempotency guard: only the first concurrent delivery claiming
  // status "pending" → "processing" will proceed. Subsequent Paystack retries
  // (or duplicate deliveries) see count=0 and exit immediately.
  const claimed = await db.paystackTransaction.updateMany({
    where: { reference, status: "pending" },
    data: { status: "processing" },
  });
  if (claimed.count === 0) {
    return NextResponse.json({ received: true });
  }

  const transaction = await db.paystackTransaction.findUnique({
    where: { reference },
    include: {
      order: {
        include: {
          buyer: true,
          ticketCategory: {
            include: {
              event: { select: { id: true, title: true, date: true, endDate: true, venue: true, city: true, experienceType: true } },
              installmentPlan: { include: { scheduleItems: true } },
            },
          },
          payments: { orderBy: { paymentNumber: "asc" } },
          tickets: true,
        },
      },
    },
  });

  if (!transaction) {
    return NextResponse.json({ received: true });
  }

  // ── Cart checkout (multi-order, upfront only) ─────────────────────────────
  const txMeta = transaction.metadata as Record<string, unknown> | null;
  if (txMeta?.isCart === true) {
    const orderIds = (txMeta.orderIds as string[]) ?? [transaction.orderId];

    const cartOrders = await db.order.findMany({
      where: { id: { in: orderIds } },
      include: {
        buyer: true,
        ticketCategory: { include: { event: { select: { id: true, title: true, date: true, endDate: true, venue: true, city: true, experienceType: true } } } },
        payments: { orderBy: { paymentNumber: "asc" } },
        tickets: true,
      },
    });

    if (!cartOrders.length) return NextResponse.json({ received: true });

    const cartBuyer = cartOrders[0].buyer;
    const cartEvent = cartOrders[0].ticketCategory.event;

    const ticketsByCategory = await db.$transaction(async (tx) => {
      await tx.paystackTransaction.update({
        where: { reference },
        data: { status: "success", paystackRef: event.data.id?.toString() },
      });

      const result: Array<{ name: string; quantity: number; ticketNumbers: string[] }> = [];

      const prefix = cartEvent.title
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 4);

      const isGroupTrip = cartEvent.experienceType === "GROUP_TRIP";

      for (const order of cartOrders) {
        const initialPayment = order.payments.find((p) => p.paymentNumber === 0);
        if (initialPayment && initialPayment.status !== "PAID") {
          await tx.installmentPayment.update({
            where: { id: initialPayment.id },
            data: { status: "PAID", paidAt: new Date(), paidAmount: initialPayment.amount },
          });
        }

        await tx.order.update({
          where: { id: order.id },
          data: { paidAmount: order.totalAmount, status: "PAID_IN_FULL" },
        });

        await tx.ticketCategory.update({
          where: { id: order.ticketCategoryId },
          data: { soldQuantity: { increment: order.quantity } },
        });

        // Skip ticket/QR generation for group trips
        if (!isGroupTrip && order.tickets.length === 0) {
          const numbers: string[] = [];
          for (let i = 0; i < order.quantity; i++) {
            const ticketNumber = generateTicketNumber(prefix);
            await tx.ticket.create({
              data: {
                orderId: order.id,
                ticketCategoryId: order.ticketCategoryId,
                ticketNumber,
                status: "ACTIVE",
                currentOwnerId: cartBuyer.id,
              },
            });
            numbers.push(ticketNumber);
          }
          result.push({ name: order.ticketCategory.name, quantity: order.quantity, ticketNumbers: numbers });
        }
      }

      return result;
    });

    const eventDate = format(cartEvent.date, "EEEE, dd MMMM yyyy · HH:mm");
    const venue = `${cartEvent.venue}${cartEvent.city ? `, ${cartEvent.city}` : ""}`;
    const isGroupTrip = cartEvent.experienceType === "GROUP_TRIP";

    try {
      if (isGroupTrip) {
        const totalPaid = cartOrders.reduce((s, o) => s + Number(o.totalAmount), 0);
        await sendBookingConfirmation({
          to: cartBuyer.email,
          name: cartBuyer.name ?? "there",
          eventTitle: cartEvent.title,
          categoryName: cartOrders.map((o) => o.ticketCategory.name).join(", "),
          quantity: cartOrders.reduce((s, o) => s + o.quantity, 0),
          totalAmount: totalPaid,
          paidAmount: totalPaid,
          eventDate,
          venue,
        });
      } else {
        await sendCartConfirmation({
          to: cartBuyer.email,
          name: cartBuyer.name ?? "there",
          eventTitle: cartEvent.title,
          eventDate,
          venue,
          categories: ticketsByCategory,
        });
      }
    } catch (err) {
      console.error("[webhook] cart email threw:", err);
    }

    return NextResponse.json({ received: true });
  }

  const { order } = transaction;
  const { buyer, ticketCategory } = order;
  const event_ = ticketCategory.event;
  const plan = ticketCategory.installmentPlan;

  const paymentMode = (txMeta?.paymentMode as string) ?? "installment";
  const isFollowOnPayment = !!transaction.installmentPaymentId || txMeta?.isFollowOn === true;

  await db.$transaction(async (tx) => {
    // Mark Paystack transaction as successful
    await tx.paystackTransaction.update({
      where: { reference },
      data: { status: "success", paystackRef: event.data.id?.toString() },
    });

    // Mark installment payment records as PAID based on mode
    if (paymentMode === "complete") {
      for (const payment of order.payments.filter((p) => p.paymentNumber > 0 && (p.status === "PENDING" || p.status === "OVERDUE"))) {
        await tx.installmentPayment.update({
          where: { id: payment.id },
          data: { status: "PAID", paidAt: new Date(), paidAmount: payment.amount },
        });
      }
    } else if (paymentMode === "custom") {
      let remaining = amountNaira;
      for (const payment of order.payments.filter((p) => p.paymentNumber > 0 && p.status === "PENDING")) {
        const alreadyPaid = Number(payment.paidAmount);
        const stillOwed = Number(payment.amount) - alreadyPaid;
        if (remaining >= stillOwed - 0.01) {
          await tx.installmentPayment.update({
            where: { id: payment.id },
            data: { status: "PAID", paidAt: new Date(), paidAmount: payment.amount },
          });
          remaining -= stillOwed;
          if (remaining <= 0) break;
        } else {
          // Partial credit toward this installment
          await tx.installmentPayment.update({
            where: { id: payment.id },
            data: { paidAmount: { increment: remaining } },
          });
          break;
        }
      }
    } else if (isFollowOnPayment && transaction.installmentPaymentId) {
      const installment = order.payments.find((p) => p.id === transaction.installmentPaymentId);
      await tx.installmentPayment.update({
        where: { id: transaction.installmentPaymentId },
        data: { status: "PAID", paidAt: new Date(), paidAmount: installment?.amount },
      });
    } else {
      const initialPayment = order.payments.find((p) => p.paymentNumber === 0);
      if (initialPayment && initialPayment.status !== "PAID") {
        await tx.installmentPayment.update({
          where: { id: initialPayment.id },
          data: { status: "PAID", paidAt: new Date(), paidAmount: initialPayment.amount },
        });
      }
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

    // Increment soldQuantity only on first payment
    if (!isFollowOnPayment) {
      await tx.ticketCategory.update({
        where: { id: ticketCategory.id },
        data: { soldQuantity: { increment: order.quantity } },
      });
    }

    // Generate tickets only on first payment, and only for non-GROUP_TRIP experiences
    if (!isFollowOnPayment && order.tickets.length === 0 && event_.experienceType !== "GROUP_TRIP") {
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

  // Cancel BullMQ reminder + revocation jobs for paid installments
  if (paymentMode === "complete") {
    const allIds = order.payments.filter((p) => p.paymentNumber > 0).map((p) => p.id);
    if (allIds.length) await cancelInstallmentJobs(allIds);
  } else if (paymentMode === "custom") {
    // Reload to find which installments are now PAID
    const freshPayments = await db.installmentPayment.findMany({
      where: { orderId: order.id, paymentNumber: { gt: 0 }, status: "PAID" },
      select: { id: true },
    });
    const prevPaidIds = new Set(order.payments.filter((p) => p.status === "PAID").map((p) => p.id));
    const newlyPaidIds = freshPayments.filter((p) => !prevPaidIds.has(p.id)).map((p) => p.id);
    if (newlyPaidIds.length) await cancelInstallmentJobs(newlyPaidIds);
  } else if (isFollowOnPayment && transaction.installmentPaymentId) {
    await cancelInstallmentJobs([transaction.installmentPaymentId]);
  }

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

    if (event_.experienceType === "GROUP_TRIP") {
      await sendBookingConfirmation({
        to: buyer.email,
        name: buyer.name ?? "there",
        eventTitle: event_.title,
        categoryName: ticketCategory.name,
        quantity: order.quantity,
        totalAmount: Number(order.totalAmount),
        paidAmount: Number(updatedOrder.paidAmount),
        eventDate,
        venue,
      });
    } else if (isFullyPaid) {
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
          amount: Number(p.amount) - Number(p.paidAmount),
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

  // Schedule reminder + revocation jobs on initial payment only.
  // Follow-on payments: jobs were already scheduled at purchase; the paid one was cancelled above.
  if (!isFollowOnPayment && !isFullyPaid && plan) {
    const pendingPayments = updatedOrder.payments.filter(
      (p) => p.paymentNumber > 0 && p.status === "PENDING"
    );
    for (const payment of pendingPayments) {
      await scheduleInstallmentReminder(payment.id, order.id, payment.dueDate);
      await scheduleDefaultWarnings(payment.id, order.id, payment.dueDate, plan.gracePeriodDays);
      await scheduleTicketRevocation(order.id, payment.id, payment.dueDate, plan.gracePeriodDays);
    }
  }

  return NextResponse.json({ received: true });
}
