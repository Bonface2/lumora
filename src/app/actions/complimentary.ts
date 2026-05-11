"use server";

import crypto from "crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendTicketConfirmation } from "@/lib/email";
import { format } from "date-fns";
import type { ApiResponse } from "@/types";

function generateTicketNumber(prefix: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(8);
  const random = Array.from(bytes, (b) => chars[b % chars.length]).join("");
  return `${prefix}-${random}`;
}

export async function addCompCategory(input: {
  eventId: string;
  name: string;
  quantity: number;
}): Promise<ApiResponse<{ id: string; name: string; totalQuantity: number; soldQuantity: number }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "SELLER") {
    return { ok: false, error: "Unauthorized." };
  }

  const { eventId, name, quantity } = input;

  if (!name.trim()) return { ok: false, error: "Category name is required." };
  if (quantity < 1) return { ok: false, error: "Quantity must be at least 1." };

  const event = await db.event.findFirst({ where: { id: eventId, sellerId: session.user.id } });
  if (!event) return { ok: false, error: "Event not found." };

  const category = await db.ticketCategory.create({
    data: {
      eventId,
      name: name.trim(),
      price: 0,
      totalQuantity: quantity,
      soldQuantity: 0,
      allowInstallments: false,
      isComplimentary: true,
      sortOrder: 999,
    },
  });

  return { ok: true, data: { id: category.id, name: category.name, totalQuantity: category.totalQuantity, soldQuantity: category.soldQuantity } };
}

export async function deleteCompCategory(input: {
  eventId: string;
  categoryId: string;
}): Promise<ApiResponse<void>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "SELLER") {
    return { ok: false, error: "Unauthorized." };
  }

  const { eventId, categoryId } = input;

  const event = await db.event.findFirst({ where: { id: eventId, sellerId: session.user.id } });
  if (!event) return { ok: false, error: "Event not found." };

  const category = await db.ticketCategory.findFirst({ where: { id: categoryId, eventId, isComplimentary: true } });
  if (!category) return { ok: false, error: "Category not found." };

  if (category.soldQuantity > 0) {
    return { ok: false, error: "Cannot delete a category that has already issued tickets." };
  }

  await db.ticketCategory.delete({ where: { id: categoryId } });
  return { ok: true, data: undefined };
}

export async function topUpCompCategory(input: {
  eventId: string;
  categoryId: string;
  additionalQuantity: number;
}): Promise<ApiResponse<{ totalQuantity: number }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "SELLER") {
    return { ok: false, error: "Unauthorized." };
  }

  const { eventId, categoryId, additionalQuantity } = input;
  if (additionalQuantity < 1) return { ok: false, error: "Must add at least 1." };

  const event = await db.event.findFirst({ where: { id: eventId, sellerId: session.user.id } });
  if (!event) return { ok: false, error: "Event not found." };

  const category = await db.ticketCategory.findFirst({ where: { id: categoryId, eventId } });
  if (!category) return { ok: false, error: "Category not found." };

  const updated = await db.ticketCategory.update({
    where: { id: categoryId },
    data: { totalQuantity: { increment: additionalQuantity } },
  });

  return { ok: true, data: { totalQuantity: updated.totalQuantity } };
}

export async function generateCompTicket(input: {
  eventId: string;
  categoryId: string;
  recipientEmail: string;
  recipientName: string;
  quantity?: number;
}): Promise<ApiResponse<{ ticketNumbers: string[] }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "SELLER") {
    return { ok: false, error: "Unauthorized." };
  }

  const { eventId, categoryId, recipientEmail, recipientName } = input;
  const quantity = Math.max(1, input.quantity ?? 1);

  // Verify event belongs to this seller
  const event = await db.event.findFirst({
    where: { id: eventId, sellerId: session.user.id },
  });
  if (!event) return { ok: false, error: "Event not found." };

  // Verify category belongs to event and has enough capacity
  const category = await db.ticketCategory.findFirst({
    where: { id: categoryId, eventId },
  });
  if (!category) return { ok: false, error: "Ticket category not found." };
  const remaining = category.totalQuantity - category.soldQuantity;
  if (remaining <= 0) {
    return { ok: false, error: "This ticket category is sold out." };
  }
  if (quantity > remaining) {
    return { ok: false, error: `Only ${remaining} ticket${remaining > 1 ? "s" : ""} remaining in this category.` };
  }

  // Find or create the recipient user
  let recipient = await db.user.findUnique({ where: { email: recipientEmail } });
  if (!recipient) {
    const randomPassword = crypto.randomBytes(16).toString("hex");
    recipient = await db.user.create({
      data: {
        email: recipientEmail,
        name: recipientName,
        password: randomPassword,
        role: "BUYER",
      },
    });
  }

  const prefix = event.title
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 4);

  // Create one order with all tickets in a single transaction
  const ticketNumbers = await db.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        buyerId: recipient!.id,
        ticketCategoryId: categoryId,
        quantity,
        totalAmount: 0,
        paidAmount: 0,
        status: "PAID_IN_FULL",
        usesInstallments: false,
      },
    });

    await tx.ticketCategory.update({
      where: { id: categoryId },
      data: { soldQuantity: { increment: quantity } },
    });

    const numbers: string[] = [];
    for (let i = 0; i < quantity; i++) {
      const ticketNumber = generateTicketNumber(prefix);
      await tx.ticket.create({
        data: {
          orderId: order.id,
          ticketCategoryId: categoryId,
          ticketNumber,
          status: "ACTIVE",
          currentOwnerId: recipient!.id,
        },
      });
      numbers.push(ticketNumber);
    }

    return numbers;
  });

  // Send one confirmation email with all ticket numbers
  try {
    await sendTicketConfirmation({
      to: recipientEmail,
      name: recipientName || "there",
      eventTitle: event.title,
      categoryName: category.name,
      ticketNumbers,
      eventDate: format(event.date, "EEEE, dd MMMM yyyy · HH:mm"),
      venue: `${event.venue}${event.city ? `, ${event.city}` : ""}`,
    });
  } catch (err) {
    console.error("[comp ticket] email error:", err);
  }

  return { ok: true, data: { ticketNumbers } };
}
