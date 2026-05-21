"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { format, addDays } from "date-fns";
import { initializePayment, generateReference } from "@/lib/intasend";
import { generateTicketNumber, eventTitlePrefix } from "@/lib/tickets";
import { getPlatformConfig } from "@/lib/platformConfig";
import type { ApiResponse } from "@/types";

const TRANSFER_EXPIRY_DAYS = 1;

export async function initiateTransfer(
  orderId: string,
  toEmail: string,
  senderOptions: { payFee: boolean; payArrears: boolean } = { payFee: false, payArrears: false }
): Promise<ApiResponse<{ transferId?: string; paymentUrl?: string }>> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Please sign in." };

  const normalizedEmail = toEmail.trim().toLowerCase();

  if (normalizedEmail === session.user.email?.toLowerCase()) {
    return { ok: false, error: "You cannot transfer to yourself." };
  }

  const order = await db.order.findFirst({
    where: { id: orderId, buyerId: session.user.id },
    include: {
      tickets: true,
      ticketCategory: { include: { event: true } },
      payments: { orderBy: { paymentNumber: "asc" } },
    },
  });

  if (!order) return { ok: false, error: "Order not found." };
  if (order.ticketCategory.event.experienceType !== "PUBLIC") {
    return { ok: false, error: "Ticket transfers are only available for public events." };
  }
  if (["REVOKED", "CANCELLED", "DEFAULTED"].includes(order.status)) {
    return { ok: false, error: "This order cannot be transferred." };
  }
  if (order.status === "PENDING") {
    return { ok: false, error: "Payment must be received before transferring." };
  }

  // Only one pending transfer per order at a time
  const existing = await db.ticketTransfer.findFirst({
    where: { orderId, status: "PENDING" },
  });
  if (existing) {
    return { ok: false, error: "A pending transfer already exists for this order. Cancel it first." };
  }

  const now = new Date();
  const defaultedPayments = order.payments.filter(
    (p) => p.paymentNumber > 0 && p.status !== "PAID" &&
      (p.status === "DEFAULTED" || p.status === "OVERDUE" ||
        (p.status === "PENDING" && p.dueDate < now))
  );
  const defaultedTotal = defaultedPayments.reduce(
    (sum, p) => sum + (Number(p.amount) - Number(p.paidAmount)), 0,
  );

  // If sender opts to pay anything, charge them first — create the transfer record after payment
  const { transferFee } = await getPlatformConfig();
  const senderPaysArrears = senderOptions.payArrears && defaultedTotal > 0;
  const senderPaysFee = senderOptions.payFee;
  const senderChargeAmount = (senderPaysArrears ? defaultedTotal : 0) + (senderPaysFee ? transferFee : 0);

  if (senderChargeAmount > 0) {
    const reference = generateReference("TSP");
    const expiresAt = addDays(new Date(), TRANSFER_EXPIRY_DAYS);
    await db.paymentTransaction.create({
      data: {
        orderId,
        amount: senderChargeAmount,
        reference,
        status: "pending",
        metadata: {
          type: "transfer_sender_payment",
          fromUserId: session.user.id,
          toEmail: normalizedEmail,
          orderId,
          senderPaysArrears,
          senderPaysFee,
          defaultedTotal,
          transferFee,
          expiresAt: expiresAt.toISOString(),
          fromName: session.user.name ?? session.user.email ?? "Someone",
          isInstallment: order.usesInstallments && order.status !== "PAID_IN_FULL",
        },
      },
    });
    const init = await initializePayment({
      email: session.user.email!,
      amount: senderChargeAmount,
      reference,
      redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/buyer?transfer_sent=1`,
    });
    if (!init.ok) {
      await db.paymentTransaction.delete({ where: { reference } });
      return { ok: false, error: "Failed to initialise payment. Please try again." };
    }
    await db.paymentTransaction.updateMany({ where: { reference }, data: { providerRef: init.invoiceId } });
    return { ok: true, data: { paymentUrl: init.url } };
  }

  // No sender payment — create the transfer record immediately
  const toUser = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, name: true },
  });
  const expiresAt = addDays(new Date(), TRANSFER_EXPIRY_DAYS);

  const transfer = await db.ticketTransfer.create({
    data: {
      orderId,
      fromUserId: session.user.id,
      toEmail: normalizedEmail,
      toUserId: toUser?.id ?? null,
      expiresAt,
      senderPaidFee: false,
      senderPaidArrears: false,
    },
  });

  const { sendTransferInvite } = await import("@/lib/email");
  const event_ = order.ticketCategory.event;

  try {
    await sendTransferInvite({
      to: normalizedEmail,
      name: toUser?.name ?? "there",
      fromName: session.user.name ?? session.user.email ?? "Someone",
      eventTitle: event_.title,
      categoryName: order.ticketCategory.name,
      eventDate: format(event_.date, "EEEE, dd MMMM yyyy · HH:mm"),
      venue: `${event_.venue}${event_.city ? `, ${event_.city}` : ""}`,
      acceptUrl: `${process.env.NEXT_PUBLIC_APP_URL}/transfer/${transfer.token}`,
      expiresAt: format(expiresAt, "dd MMMM yyyy"),
      isInstallment: order.usesInstallments && order.status !== "PAID_IN_FULL",
      hasDefaultedPayments: defaultedPayments.length > 0,
      defaultedAmount: defaultedTotal > 0 ? `KES ${defaultedTotal.toLocaleString()}` : undefined,
      senderPaidFee: false,
      transferFee,
    });
  } catch (err) {
    console.error("[transfer] invite email threw:", err);
  }

  return { ok: true, data: { transferId: transfer.id } };
}

export async function cancelTransfer(
  transferId: string
): Promise<ApiResponse<null>> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Please sign in." };

  const transfer = await db.ticketTransfer.findFirst({
    where: { id: transferId, fromUserId: session.user.id, status: "PENDING" },
    include: { order: { include: { ticketCategory: { include: { event: true } } } } },
  });
  if (!transfer) return { ok: false, error: "Transfer not found." };

  await db.ticketTransfer.update({
    where: { id: transferId },
    data: { status: "CANCELLED" },
  });

  try {
    const { sendTransferCancelled } = await import("@/lib/email");
    const toUser = await db.user.findUnique({
      where: { email: transfer.toEmail },
      select: { name: true },
    });
    await sendTransferCancelled({
      to: transfer.toEmail,
      name: toUser?.name ?? "there",
      fromName: session.user.name ?? session.user.email ?? "Someone",
      eventTitle: transfer.order.ticketCategory.event.title,
    });
  } catch (err) {
    console.error("[transfer] cancel notification threw:", err);
  }

  return { ok: true, data: null };
}

export async function getTransferByToken(token: string) {
  return db.ticketTransfer.findUnique({
    where: { token },
    include: {
      fromUser: { select: { id: true, name: true, email: true } },
      order: {
        include: {
          ticketCategory: { include: { event: true } },
          payments: { orderBy: { paymentNumber: "asc" } },
          tickets: true,
        },
      },
    },
  });
}

export async function respondToTransfer(
  token: string,
  action: "accept" | "decline"
): Promise<ApiResponse<{ paymentUrl?: string }>> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Please sign in." };

  const transfer = await db.ticketTransfer.findUnique({
    where: { token },
    include: {
      fromUser: { select: { id: true, name: true, email: true } },
      order: { include: { tickets: true, payments: true, ticketCategory: { include: { event: true } } } },
    },
  });

  if (!transfer) return { ok: false, error: "Transfer not found." };
  if (transfer.status !== "PENDING") {
    return { ok: false, error: "This transfer is no longer active." };
  }
  if (new Date() > transfer.expiresAt) {
    await db.ticketTransfer.update({ where: { token }, data: { status: "EXPIRED" } });
    return { ok: false, error: "This transfer has expired." };
  }

  // Ensure the logged-in user matches the intended recipient
  const recipientEmail = transfer.toEmail.toLowerCase();
  if (session.user.email?.toLowerCase() !== recipientEmail) {
    return { ok: false, error: "This transfer is not addressed to your account." };
  }

  if (action === "decline") {
    await db.ticketTransfer.update({ where: { token }, data: { status: "DECLINED" } });

    try {
      const { sendTransferNotification } = await import("@/lib/email");
      await sendTransferNotification({
        to: transfer.fromUser.email,
        name: transfer.fromUser.name ?? "there",
        eventTitle: transfer.order.ticketCategory.event.title,
        toName: session.user.name ?? session.user.email ?? "The recipient",
        wasAccepted: false,
      });
    } catch (err) {
      console.error("[transfer] decline notification threw:", err);
    }

    return { ok: true, data: {} };
  }

  // Calculate what the recipient still owes (sender may have already covered some)
  const { transferFee } = await getPlatformConfig();
  const nowR = new Date();
  const defaultedPayments = transfer.order.payments.filter(
    (p) => p.paymentNumber > 0 && p.status !== "PAID" &&
      (p.status === "DEFAULTED" || p.status === "OVERDUE" ||
        (p.status === "PENDING" && p.dueDate < nowR))
  );
  const defaultedTotal = transfer.senderPaidArrears
    ? 0
    : defaultedPayments.reduce((sum, p) => sum + (Number(p.amount) - Number(p.paidAmount)), 0);
  const recipientFee = transfer.senderPaidFee ? 0 : transferFee;
  const chargeAmount = defaultedTotal + recipientFee;

  // Sender covered everything — transfer ownership directly, no payment needed
  if (chargeAmount === 0) {
    const newTicketNumbers: string[] = [];
    const prefix = eventTitlePrefix(transfer.order.ticketCategory.event.title);
    const newOwnerId = session.user.id;

    await db.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: transfer.orderId },
        data: { buyerId: newOwnerId, originalBuyerId: transfer.order.originalBuyerId ?? transfer.fromUserId },
      });
      for (const ticket of transfer.order.tickets) {
        const newNumber = generateTicketNumber(prefix);
        newTicketNumbers.push(newNumber);
        await tx.ticket.update({
          where: { id: ticket.id },
          data: { currentOwnerId: newOwnerId, ticketNumber: newNumber, qrCode: null },
        });
      }
      await tx.ticketTransfer.update({ where: { token }, data: { status: "ACCEPTED", toUserId: newOwnerId } });
      await tx.ticketTransfer.updateMany({
        where: { orderId: transfer.orderId, status: "PENDING", token: { not: token } },
        data: { status: "CANCELLED" },
      });
    });

    const event_ = transfer.order.ticketCategory.event;
    try {
      const { sendTransferNotification, sendTicketConfirmation, sendTransferAcceptedInstallment } = await import("@/lib/email");
      await sendTransferNotification({ to: transfer.fromUser.email, name: transfer.fromUser.name ?? "there", eventTitle: event_.title, toName: session.user.name ?? session.user.email ?? "The recipient", wasAccepted: true });
      if (transfer.order.status === "PAID_IN_FULL") {
        await sendTicketConfirmation({ to: session.user.email!, name: session.user.name ?? "there", eventTitle: event_.title, categoryName: transfer.order.ticketCategory.name, ticketNumbers: newTicketNumbers, eventDate: format(event_.date, "EEEE, dd MMMM yyyy · HH:mm"), venue: `${event_.venue}${event_.city ? `, ${event_.city}` : ""}` });
      } else {
        const remainingPayments = transfer.order.payments.filter((p) => p.status !== "PAID").map((p) => ({ paymentNumber: p.paymentNumber, amount: Number(p.amount) - Number(p.paidAmount), dueDate: format(p.dueDate, "dd MMM yyyy") }));
        await sendTransferAcceptedInstallment({ to: session.user.email!, name: session.user.name ?? "there", fromName: transfer.fromUser.name ?? transfer.fromUser.email, eventTitle: event_.title, categoryName: transfer.order.ticketCategory.name, eventDate: format(event_.date, "EEEE, dd MMMM yyyy · HH:mm"), venue: `${event_.venue}${event_.city ? `, ${event_.city}` : ""}`, totalAmount: Number(transfer.order.totalAmount), totalPaid: Number(transfer.order.paidAmount), remainingPayments, dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/buyer` });
      }
    } catch (err) {
      console.error("[transfer] free-accept emails threw:", err);
    }
    return { ok: true, data: {} };
  }

  // Recipient owes something — redirect to payment
  const reference = generateReference("TRF");
  await db.paymentTransaction.create({
    data: {
      orderId: transfer.orderId,
      amount: chargeAmount,
      reference,
      status: "pending",
      metadata: {
        type: "transfer_fee_payment",
        transferToken: token,
        toUserId: session.user!.id,
        fromUserId: transfer.fromUserId,
        orderId: transfer.orderId,
        defaultedTotal,
        transferFee: recipientFee,
      },
    },
  });
  const init = await initializePayment({
    email: session.user!.email!,
    amount: chargeAmount,
    reference,
    redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/buyer?transferred=1`,
  });
  if (!init.ok) {
    await db.paymentTransaction.delete({ where: { reference } });
    return { ok: false, error: "Failed to initialise payment. Please try again." };
  }
  await db.paymentTransaction.updateMany({ where: { reference }, data: { providerRef: init.invoiceId } });
  return { ok: true, data: { paymentUrl: init.url } };
}

export async function getPendingTransferForOrder(orderId: string) {
  return db.ticketTransfer.findFirst({
    where: { orderId, status: "PENDING" },
    select: { id: true, toEmail: true, expiresAt: true },
  });
}
