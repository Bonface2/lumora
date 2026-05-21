import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendTicketConfirmation, sendInstallmentReceipt, sendCartConfirmation, sendBookingConfirmation } from "@/lib/email";
import {
  scheduleInstallmentReminder,
  scheduleDefaultWarnings,
  scheduleTicketRevocation,
  cancelInstallmentJobs,
} from "@/lib/queue";
import { generateTicketNumber, eventTitlePrefix } from "@/lib/tickets";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

interface IntaSendWebhookPayload {
  // Checkout/collection fields
  invoice_id?: string;
  state?: string; // "COMPLETE" | "PENDING" | "FAILED" | "CANCELLED"
  api_ref?: string; // our internal reference
  amount?: number; // KES
  currency?: string;
  account?: string;
  payment_channel?: string;
  // Send-money/payout fields
  tracking_id?: string;
  status?: string; // "COMPLETE" | "FAILED" | "PENDING"
  // Common
  challenge: string;
}

export async function POST(req: Request) {
  console.log("[intasend-webhook] POST received at", new Date().toISOString());
  const body = await req.text();

  let payload: IntaSendWebhookPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Verify challenge token
  if (payload.challenge !== process.env.INTASEND_WEBHOOK_CHALLENGE) {
    console.log("[intasend-webhook] Invalid challenge token");
    return NextResponse.json({ error: "Invalid challenge" }, { status: 401 });
  }

  // ── Send-money (payout) webhook ──────────────────────────────────────────────
  if (payload.tracking_id) {
    const payoutStatus = payload.status === "COMPLETE" ? "success"
      : payload.status === "FAILED" ? "failed"
      : null;
    if (payoutStatus) {
      await db.payout.updateMany({
        where: { providerRef: payload.tracking_id },
        data: { status: payoutStatus },
      });
    }
    return NextResponse.json({ received: true });
  }

  // Only process completed payments
  if (payload.state !== "COMPLETE") {
    return NextResponse.json({ received: true });
  }

  const reference = payload.api_ref ?? "";
  const amountKes = payload.amount ?? 0; // already in KES

  const webhookMeta = await (async () => {
    const tx = await db.paymentTransaction.findUnique({
      where: { reference },
      select: { metadata: true },
    });
    return tx?.metadata as Record<string, unknown> | null;
  })();

  // ── Transfer default payment ────────────────────────────────────────────────
  if (webhookMeta?.type === "transfer_default_payment" && webhookMeta?.transferToken) {
    const transferToken = webhookMeta.transferToken as string;
    const toUserId = webhookMeta.toUserId as string;
    const orderId = webhookMeta.orderId as string;

    const newTicketNumbers: string[] = [];
    let transferEventTitle = "";
    let transferCategoryName = "";
    let transferEventDate = "";
    let transferVenue = "";

    await db.$transaction(async (tx) => {
      const transfer = await tx.ticketTransfer.findUnique({
        where: { token: transferToken },
        include: {
          order: {
            include: {
              tickets: true,
              payments: true,
              ticketCategory: { include: { event: true } },
            },
          },
        },
      });
      if (!transfer || transfer.status !== "PENDING") return;

      const event_ = transfer.order.ticketCategory.event;
      const prefix = eventTitlePrefix(event_.title);
      transferEventTitle = event_.title;
      transferCategoryName = transfer.order.ticketCategory.name;
      transferEventDate = format(event_.date, "EEEE, dd MMMM yyyy · HH:mm");
      transferVenue = `${event_.venue}${event_.city ? `, ${event_.city}` : ""}`;

      const defaulted = transfer.order.payments.filter((p) => p.status === "DEFAULTED");
      const totalPaid = defaulted.reduce((s, p) => s + (Number(p.amount) - Number(p.paidAmount)), 0);

      for (const p of defaulted) {
        await tx.installmentPayment.update({
          where: { id: p.id },
          data: { status: "PAID", paidAmount: p.amount, paidAt: new Date() },
        });
      }

      const newPaidAmount = Number(transfer.order.paidAmount) + totalPaid;
      const isFullyPaid = newPaidAmount >= Number(transfer.order.totalAmount) - 0.01;
      await tx.order.update({
        where: { id: orderId },
        data: {
          buyerId: toUserId,
          originalBuyerId: transfer.order.originalBuyerId ?? transfer.fromUserId,
          paidAmount: newPaidAmount,
          status: isFullyPaid ? "PAID_IN_FULL" : "PARTIAL_PAID",
        },
      });

      for (const ticket of transfer.order.tickets) {
        const newNumber = generateTicketNumber(prefix);
        newTicketNumbers.push(newNumber);
        await tx.ticket.update({
          where: { id: ticket.id },
          data: { currentOwnerId: toUserId, ticketNumber: newNumber, qrCode: null },
        });
      }

      await tx.ticketTransfer.update({ where: { token: transferToken }, data: { status: "ACCEPTED", toUserId } });
      await tx.ticketTransfer.updateMany({
        where: { orderId, status: "PENDING", token: { not: transferToken } },
        data: { status: "CANCELLED" },
      });
      await tx.paymentTransaction.updateMany({ where: { reference }, data: { status: "success" } });
    });

    if (newTicketNumbers.length > 0) {
      try {
        const newOwner = await db.user.findUnique({ where: { id: toUserId }, select: { email: true, name: true } });
        if (newOwner?.email) {
          await sendTicketConfirmation({
            to: newOwner.email,
            name: newOwner.name ?? "there",
            eventTitle: transferEventTitle,
            categoryName: transferCategoryName,
            ticketNumbers: newTicketNumbers,
            eventDate: transferEventDate,
            venue: transferVenue,
          });
        }
      } catch (err) {
        console.error("[intasend-webhook] transfer ticket email threw:", err);
      }
    }

    return NextResponse.json({ received: true });
  }

  // ── Platform fee payment (free event activation / tier upgrade) ─────────────
  if (webhookMeta?.type === "free_event_fee" && webhookMeta?.eventId) {
    const paidKes = amountKes;
    if (paidKes > 0) {
      const currentEvent = await db.event.findUnique({
        where: { id: webhookMeta.eventId as string },
        select: { platformFeeAmount: true },
      });
      const previouslyPaid = Number(currentEvent?.platformFeeAmount ?? 0);
      await db.event.update({
        where: { id: webhookMeta.eventId as string },
        data: {
          platformFeePaid: true,
          attendeeCap: (webhookMeta.tierCap as number | null) ?? null,
          platformFeeAmount: previouslyPaid + paidKes,
        },
      });
    }
    return NextResponse.json({ received: true });
  }

  // Atomic idempotency guard
  const claimed = await db.paymentTransaction.updateMany({
    where: { reference, status: "pending" },
    data: { status: "processing" },
  });
  if (claimed.count === 0) {
    return NextResponse.json({ received: true });
  }

  const transaction = await db.paymentTransaction.findUnique({
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

  // ── Cart checkout ─────────────────────────────────────────────────────────
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
      await tx.paymentTransaction.update({
        where: { reference },
        data: { status: "success", providerRef: payload.invoice_id },
      });

      const result: Array<{ name: string; quantity: number; ticketNumbers: string[] }> = [];

      const prefix = cartEvent.title.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 4);
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

        if (!isGroupTrip && order.tickets.length === 0) {
          const numbers: string[] = [];
          for (let i = 0; i < order.quantity; i++) {
            const ticketNumber = generateTicketNumber(prefix);
            await tx.ticket.create({
              data: { orderId: order.id, ticketCategoryId: order.ticketCategoryId, ticketNumber, status: "ACTIVE", currentOwnerId: cartBuyer.id },
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
      console.error("[intasend-webhook] cart email threw:", err);
    }

    const cartInviteToken = txMeta?.inviteToken as string | undefined;
    if (cartInviteToken) {
      await db.privateEventToken.updateMany({
        where: { token: cartInviteToken },
        data: { useCount: { increment: 1 } },
      });
    }

    return NextResponse.json({ received: true });
  }

  // ── Single-order payment ──────────────────────────────────────────────────
  const { order } = transaction;
  const { buyer, ticketCategory } = order;
  const event_ = ticketCategory.event;
  const plan = ticketCategory.installmentPlan;

  const paymentMode = (txMeta?.paymentMode as string) ?? "installment";
  const isFollowOnPayment = !!transaction.installmentPaymentId || txMeta?.isFollowOn === true;

  await db.$transaction(async (tx) => {
    await tx.paymentTransaction.update({
      where: { reference },
      data: { status: "success", providerRef: payload.invoice_id },
    });

    if (paymentMode === "complete") {
      for (const payment of order.payments.filter((p) => p.paymentNumber > 0 && (p.status === "PENDING" || p.status === "OVERDUE"))) {
        await tx.installmentPayment.update({
          where: { id: payment.id },
          data: { status: "PAID", paidAt: new Date(), paidAmount: payment.amount },
        });
      }
    } else if (paymentMode === "custom") {
      let remaining = amountKes;
      for (const payment of order.payments.filter((p) => p.paymentNumber > 0 && p.status === "PENDING")) {
        const stillOwed = Number(payment.amount) - Number(payment.paidAmount);
        if (remaining >= stillOwed - 0.01) {
          await tx.installmentPayment.update({
            where: { id: payment.id },
            data: { status: "PAID", paidAt: new Date(), paidAmount: payment.amount },
          });
          remaining -= stillOwed;
          if (remaining <= 0) break;
        } else {
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

    const newPaidAmount = Number(order.paidAmount) + amountKes;
    const isFullyPaid = newPaidAmount >= Number(order.totalAmount) - 0.01;

    await tx.order.update({
      where: { id: order.id },
      data: { paidAmount: newPaidAmount, status: isFullyPaid ? "PAID_IN_FULL" : "PARTIAL_PAID" },
    });

    if (!isFollowOnPayment) {
      await tx.ticketCategory.update({
        where: { id: ticketCategory.id },
        data: { soldQuantity: { increment: order.quantity } },
      });
    }

    if (!isFollowOnPayment && order.tickets.length === 0 && event_.experienceType !== "GROUP_TRIP") {
      const prefix = event_.title.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 4);
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

  // Cancel BullMQ jobs for paid installments
  try {
    if (paymentMode === "complete") {
      const allIds = order.payments.filter((p) => p.paymentNumber > 0).map((p) => p.id);
      if (allIds.length) await cancelInstallmentJobs(allIds);
    } else if (paymentMode === "custom") {
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
  } catch (err) {
    console.error("[intasend-webhook] cancelInstallmentJobs threw:", err);
  }

  const updatedOrder = await db.order.findUniqueOrThrow({
    where: { id: order.id },
    include: { tickets: true, payments: true },
  });

  const ticketNumbers = updatedOrder.tickets.map((t) => t.ticketNumber);
  const isFullyPaid = Number(updatedOrder.paidAmount) >= Number(updatedOrder.totalAmount) - 0.01;

  try {
    const eventDate = format(event_.date, "EEEE, dd MMMM yyyy · HH:mm");
    const venue = `${event_.venue}${event_.city ? `, ${event_.city}` : ""}`;

    if (event_.experienceType === "GROUP_TRIP") {
      if (!isFollowOnPayment || isFullyPaid) {
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
      } else {
        const remainingPayments = updatedOrder.payments
          .filter((p) => p.paymentNumber > 0 && p.status === "PENDING")
          .map((p) => ({ installmentNumber: p.paymentNumber, amount: Number(p.amount) - Number(p.paidAmount), dueDate: format(p.dueDate, "dd MMM yyyy") }));
        await sendInstallmentReceipt({
          to: buyer.email,
          name: buyer.name ?? "there",
          eventTitle: event_.title,
          categoryName: ticketCategory.name,
          eventDate,
          venue,
          amountPaid: amountKes,
          totalPaid: Number(updatedOrder.paidAmount),
          totalAmount: Number(updatedOrder.totalAmount),
          remainingPayments,
          isDeposit: false,
        });
      }
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
        .map((p) => ({ installmentNumber: p.paymentNumber, amount: Number(p.amount) - Number(p.paidAmount), dueDate: format(p.dueDate, "dd MMM yyyy") }));
      await sendInstallmentReceipt({
        to: buyer.email,
        name: buyer.name ?? "there",
        eventTitle: event_.title,
        categoryName: ticketCategory.name,
        eventDate,
        venue,
        amountPaid: amountKes,
        totalPaid: Number(updatedOrder.paidAmount),
        totalAmount: Number(updatedOrder.totalAmount),
        remainingPayments,
        isDeposit: !isFollowOnPayment,
      });
    }
  } catch (err) {
    console.error("[intasend-webhook] email threw for order", order.id, ":", err);
  }

  if (!isFollowOnPayment && !isFullyPaid && plan) {
    const pendingPayments = updatedOrder.payments.filter((p) => p.paymentNumber > 0 && p.status === "PENDING");
    for (const payment of pendingPayments) {
      await scheduleDefaultWarnings(payment.id, order.id, payment.dueDate, plan.gracePeriodDays, event_.date, plan.enforceRevocation, plan.graceOverridesEventCutoff);
      if (plan.enforceRevocation) {
        await scheduleInstallmentReminder(payment.id, order.id, payment.dueDate);
        await scheduleTicketRevocation(order.id, payment.id, payment.dueDate, plan.gracePeriodDays, event_.date, plan.graceOverridesEventCutoff);
      }
    }
  }

  if (!isFollowOnPayment) {
    const singleInviteToken = txMeta?.inviteToken as string | undefined;
    if (singleInviteToken) {
      await db.privateEventToken.updateMany({
        where: { token: singleInviteToken },
        data: { useCount: { increment: 1 } },
      });
    }
  }

  return NextResponse.json({ received: true });
}
