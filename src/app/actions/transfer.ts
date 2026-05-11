"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { format, addDays } from "date-fns";
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
): Promise<ApiResponse<null>> {
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

    return { ok: true, data: null };
  }

  // Accept — transfer ownership in a transaction
  await db.$transaction(async (tx) => {
    const newOwnerId = session.user!.id;

    // Update order ownership
    await tx.order.update({
      where: { id: transfer.orderId },
      data: {
        buyerId: newOwnerId,
        originalBuyerId: transfer.order.originalBuyerId ?? transfer.fromUserId,
      },
    });

    // Update all ticket ownership
    for (const ticket of transfer.order.tickets) {
      await tx.ticket.update({
        where: { id: ticket.id },
        data: { currentOwnerId: newOwnerId },
      });
    }

    // Mark transfer as accepted, record the recipient user id
    await tx.ticketTransfer.update({
      where: { token },
      data: { status: "ACCEPTED", toUserId: newOwnerId },
    });

    // Cancel any other pending transfers for the same order
    await tx.ticketTransfer.updateMany({
      where: { orderId: transfer.orderId, status: "PENDING", token: { not: token } },
      data: { status: "CANCELLED" },
    });
  });

  // Notify sender
  try {
    const { sendTransferNotification } = await import("@/lib/email");
    await sendTransferNotification({
      to: transfer.fromUser.email,
      name: transfer.fromUser.name ?? "there",
      eventTitle: transfer.order.ticketCategory.event.title,
      toName: session.user.name ?? session.user.email ?? "The recipient",
      wasAccepted: true,
    });
  } catch (err) {
    console.error("[transfer] accept notification threw:", err);
  }

  return { ok: true, data: null };
}

export async function getPendingTransferForOrder(orderId: string) {
  return db.ticketTransfer.findFirst({
    where: { orderId, status: "PENDING" },
    select: { id: true, toEmail: true, expiresAt: true },
  });
}
