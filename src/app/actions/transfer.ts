"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { format, addDays } from "date-fns";
import { initializePayment, toKobo, generateReference } from "@/lib/paystack";
import { generateTicketNumber, eventTitlePrefix } from "@/lib/tickets";
import type { ApiResponse } from "@/types";

const TRANSFER_EXPIRY_DAYS = 1;

export async function initiateTransfer(
  orderId: string,
  toEmail: string
): Promise<ApiResponse<{ transferId: string }>> {
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
    },
  });

  // Send email — import here to avoid circular deps
  const { sendTransferInvite } = await import("@/lib/email");
  const event_ = order.ticketCategory.event;

  const defaultedPayments = order.payments.filter((p) => p.status === "DEFAULTED");
  const defaultedTotal = defaultedPayments.reduce(
    (sum, p) => sum + (Number(p.amount) - Number(p.paidAmount)), 0,
  );

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
  });
  if (!transfer) return { ok: false, error: "Transfer not found." };

  await db.ticketTransfer.update({
    where: { id: transferId },
    data: { status: "CANCELLED" },
  });

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
): Promise<ApiResponse<{ paystackUrl?: string }>> {
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

  // If there are defaulted payments the recipient must pay them before taking ownership
  const defaultedPayments = transfer.order.payments.filter((p) => p.status === "DEFAULTED");
  if (defaultedPayments.length > 0) {
    const defaultedTotal = defaultedPayments.reduce(
      (sum, p) => sum + (Number(p.amount) - Number(p.paidAmount)), 0,
    );
    const reference = generateReference("TDF");
    await db.paystackTransaction.create({
      data: {
        orderId: transfer.orderId,
        amount: defaultedTotal,
        reference,
        status: "pending",
        metadata: {
          type: "transfer_default_payment",
          transferToken: token,
          toUserId: session.user!.id,
          orderId: transfer.orderId,
        },
      },
    });
    const init = await initializePayment({
      email: session.user!.email!,
      amount: toKobo(defaultedTotal),
      reference,
      metadata: {
        type: "transfer_default_payment",
        transferToken: token,
        toUserId: session.user!.id,
        orderId: transfer.orderId,
      },
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/buyer?transferred=1`,
    });
    return { ok: true, data: { paystackUrl: init.data.authorization_url } };
  }

  // Accept — transfer ownership in a transaction, regenerating ticket numbers
  const newTicketNumbers: string[] = [];
  const prefix = eventTitlePrefix(transfer.order.ticketCategory.event.title);

  await db.$transaction(async (tx) => {
    const newOwnerId = session.user!.id;

    await tx.order.update({
      where: { id: transfer.orderId },
      data: {
        buyerId: newOwnerId,
        originalBuyerId: transfer.order.originalBuyerId ?? transfer.fromUserId,
      },
    });

    // Regenerate each ticket number so the original QR codes are invalidated
    for (const ticket of transfer.order.tickets) {
      const newNumber = generateTicketNumber(prefix);
      newTicketNumbers.push(newNumber);
      await tx.ticket.update({
        where: { id: ticket.id },
        data: { currentOwnerId: newOwnerId, ticketNumber: newNumber, qrCode: null },
      });
    }

    await tx.ticketTransfer.update({
      where: { token },
      data: { status: "ACCEPTED", toUserId: newOwnerId },
    });

    await tx.ticketTransfer.updateMany({
      where: { orderId: transfer.orderId, status: "PENDING", token: { not: token } },
      data: { status: "CANCELLED" },
    });
  });

  const event_ = transfer.order.ticketCategory.event;

  // Notify sender
  try {
    const { sendTransferNotification } = await import("@/lib/email");
    await sendTransferNotification({
      to: transfer.fromUser.email,
      name: transfer.fromUser.name ?? "there",
      eventTitle: event_.title,
      toName: session.user.name ?? session.user.email ?? "The recipient",
      wasAccepted: true,
    });
  } catch (err) {
    console.error("[transfer] accept notification threw:", err);
  }

  // Send new ticket with regenerated QR to the recipient
  try {
    const { sendTicketConfirmation } = await import("@/lib/email");
    await sendTicketConfirmation({
      to: session.user.email!,
      name: session.user.name ?? "there",
      eventTitle: event_.title,
      categoryName: transfer.order.ticketCategory.name,
      ticketNumbers: newTicketNumbers,
      eventDate: format(event_.date, "EEEE, dd MMMM yyyy · HH:mm"),
      venue: `${event_.venue}${event_.city ? `, ${event_.city}` : ""}`,
    });
  } catch (err) {
    console.error("[transfer] ticket confirmation email threw:", err);
  }

  return { ok: true, data: {} };
}

export async function getPendingTransferForOrder(orderId: string) {
  return db.ticketTransfer.findFirst({
    where: { orderId, status: "PENDING" },
    select: { id: true, toEmail: true, expiresAt: true },
  });
}
