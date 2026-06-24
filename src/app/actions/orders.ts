"use server";

import crypto from "crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  initializePayment,
  generateReference,
} from "@/lib/intasend";
import { sendTicketConfirmation, sendCartConfirmation, sendInstallmentReceipt, sendBookingConfirmation } from "@/lib/email";
import { getPlatformConfig } from "@/lib/platformConfig";
import type { ApiResponse } from "@/types";

function generateTicketNumber(prefix: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(8);
  const random = Array.from(bytes, (b) => chars[b % chars.length]).join("");
  return `${prefix}-${random}`;
}

export async function createOrder(input: {
  ticketCategoryId: string;
  useInstallments: boolean;
  quantity?: number;
  inviteToken?: string;
}): Promise<ApiResponse<{ paymentUrl: string; ticketNumbers?: string[] }>> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Please sign in to continue." };

  const quantity = Math.max(1, input.quantity ?? 1);

  const category = await db.ticketCategory.findUnique({
    where: { id: input.ticketCategoryId },
    include: {
      event: true,
      installmentPlan: { include: { scheduleItems: { orderBy: { installmentNumber: "asc" } } } },
    },
  });

  if (!category) return { ok: false, error: "Ticket category not found." };
  if (category.event.status !== "PUBLISHED") return { ok: false, error: "This event is not available." };

  const available = category.totalQuantity - category.soldQuantity;
  if (available <= 0) return { ok: false, error: "This ticket category is sold out." };
  if (quantity > available) return { ok: false, error: `Only ${available} ticket${available > 1 ? "s" : ""} remaining.` };

  // Enforce attendee cap for free events
  if (category.event.eventType === "FREE" && category.event.attendeeCap !== null) {
    const totalSoldAgg = await db.ticketCategory.aggregate({
      where: { eventId: category.event.id, isComplimentary: false },
      _sum: { soldQuantity: true },
    });
    const totalSold = totalSoldAgg._sum.soldQuantity ?? 0;
    const remainingInTier = Math.max(0, category.event.attendeeCap - totalSold);
    if (remainingInTier <= 0) {
      return { ok: false, error: "This event has reached its registration limit. The organiser may expand capacity soon." };
    }
    if (quantity > remainingInTier) {
      return { ok: false, error: `Only ${remainingInTier} spot${remainingInTier > 1 ? "s" : ""} left in the current tier.` };
    }
  }

  if (input.useInstallments && !category.allowInstallments) {
    return { ok: false, error: "Installments are not available for this ticket." };
  }

  const totalAmount = Number(category.price) * quantity;

  // Free event bypass — skip payment entirely
  if (totalAmount === 0) {
    const buyer = await db.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { email: true, name: true },
    });
    const prefix = category.event.title.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "X");
    const ticketNumbers: string[] = [];

    try {
      await db.$transaction(async (tx) => {
        // Atomically reserve tickets — prevents overselling under concurrent load
        const reserved = await tx.$executeRaw`
          UPDATE "TicketCategory"
          SET "soldQuantity" = "soldQuantity" + ${quantity}
          WHERE id = ${category.id} AND "soldQuantity" + ${quantity} <= "totalQuantity"
        `;
        if (reserved === 0) throw new Error("SOLD_OUT");

        const order = await tx.order.create({
          data: {
            buyerId: session.user.id,
            ticketCategoryId: category.id,
            quantity,
            totalAmount: 0,
            paidAmount: 0,
            status: "PAID_IN_FULL",
            usesInstallments: false,
            ...(input.inviteToken ? { inviteSource: "LINK" } : {}),
          },
        });
        await tx.installmentPayment.create({
          data: {
            orderId: order.id,
            paymentNumber: 0,
            amount: 0,
            dueDate: new Date(),
            status: "PAID",
          },
        });
        for (let i = 0; i < quantity; i++) {
          const num = generateTicketNumber(prefix);
          ticketNumbers.push(num);
          await tx.ticket.create({
            data: { orderId: order.id, ticketCategoryId: category.id, ticketNumber: num },
          });
        }
      });
    } catch (err) {
      if (err instanceof Error && err.message === "SOLD_OUT")
        return { ok: false, error: "This ticket category is sold out." };
      throw err;
    }

    if (input.inviteToken) {
      await db.privateEventToken.updateMany({
        where: { token: input.inviteToken },
        data: { useCount: { increment: 1 } },
      });
    }

    await sendTicketConfirmation({
      to: buyer.email,
      name: buyer.name ?? buyer.email,
      eventTitle: category.event.title,
      categoryName: category.name,
      ticketNumbers,
      eventDate: category.event.date.toISOString(),
      venue: category.event.venue,
    });

    return { ok: true, data: { paymentUrl: `${process.env.NEXT_PUBLIC_APP_URL}/buyer`, ticketNumbers } };
  }

  const plan = input.useInstallments ? category.installmentPlan : null;

  const now = new Date();
  const pastDueItems = plan?.scheduleItems.filter((s) => s.dueDate <= now) ?? [];
  const pastDuePct = pastDueItems.reduce((sum, s) => sum + Number(s.percentage), 0);
  const initialPercent = plan ? Number(plan.initialPaymentPercent) + pastDuePct : 100;
  const amountDueNow = Math.round((totalAmount * initialPercent) / 100);

  const platformConfig = await getPlatformConfig();
  const convenienceFee = platformConfig.convenienceFee;
  const installmentFee = plan ? Math.min(Math.round(totalAmount * (platformConfig.installmentFeePercent / 100)), platformConfig.installmentFeeCap) : 0;
  const chargeAmount = amountDueNow + convenienceFee + installmentFee;

  const reference = generateReference("LUM");

  const order = await db.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        buyerId: session.user.id,
        ticketCategoryId: category.id,
        quantity,
        totalAmount,
        paidAmount: 0,
        status: "PENDING",
        usesInstallments: !!plan,
        ...(input.inviteToken ? { inviteSource: "LINK" } : {}),
      },
    });

    if (plan) {
      await tx.installmentPayment.create({
        data: {
          orderId: newOrder.id,
          paymentNumber: 0,
          amount: amountDueNow,
          dueDate: new Date(),
          status: "PENDING",
        },
      });

      const futureItems = plan.scheduleItems.filter((s) => s.dueDate > now);
      for (const item of futureItems) {
        const amount = Math.round((totalAmount * Number(item.percentage)) / 100);
        await tx.installmentPayment.create({
          data: {
            orderId: newOrder.id,
            installmentScheduleItemId: item.id,
            paymentNumber: item.installmentNumber,
            amount,
            dueDate: item.dueDate,
            status: "PENDING",
          },
        });
      }
    } else {
      await tx.installmentPayment.create({
        data: {
          orderId: newOrder.id,
          paymentNumber: 0,
          amount: totalAmount,
          dueDate: new Date(),
          status: "PENDING",
        },
      });
    }

    await tx.paymentTransaction.create({
      data: {
        orderId: newOrder.id,
        amount: chargeAmount,
        reference,
        status: "pending",
        metadata: {
          orderId: newOrder.id,
          ticketCategoryId: category.id,
          useInstallments: !!plan,
          paymentNumber: 0,
          ticketAmount: amountDueNow,
          convenienceFee,
          installmentFee,
          ...(input.inviteToken ? { inviteToken: input.inviteToken } : {}),
        },
      },
    });

    return newOrder;
  });

  const buyer = await db.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { email: true },
  });

  const payment = await initializePayment({
    email: buyer.email,
    amount: chargeAmount,
    reference,
    redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/callback?reference=${reference}`,
  });

  if (!payment.ok) {
    await db.order.delete({ where: { id: order.id } });
    return { ok: false, error: "Failed to initialise payment. Please try again." };
  }

  await db.paymentTransaction.updateMany({
    where: { reference },
    data: { providerRef: payment.invoiceId },
  });

  return { ok: true, data: { paymentUrl: payment.url } };
}

export async function createCartOrder(input: {
  items: Array<{ ticketCategoryId: string; quantity: number }>;
  inviteToken?: string;
}): Promise<ApiResponse<{ paymentUrl: string; ticketNumbers?: string[] }>> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Please sign in to continue." };
  if (!input.items.length) return { ok: false, error: "No items in cart." };

  const categories = await db.ticketCategory.findMany({
    where: { id: { in: input.items.map((i) => i.ticketCategoryId) } },
    include: { event: true },
  });

  const errors: string[] = [];
  for (const item of input.items) {
    const qty = Math.max(1, item.quantity);
    const cat = categories.find((c) => c.id === item.ticketCategoryId);
    if (!cat) { errors.push(`Category not found.`); continue; }
    if (cat.event.status !== "PUBLISHED") { errors.push(`${cat.name}: event not available.`); continue; }
    const available = cat.totalQuantity - cat.soldQuantity;
    if (available <= 0) { errors.push(`${cat.name} is sold out.`); continue; }
    if (qty > available) {
      errors.push(`Only ${available} ${cat.name} ticket${available > 1 ? "s" : ""} remaining.`);
    }
  }
  if (errors.length) return { ok: false, error: errors.join(" ") };

  // Enforce attendee cap for free events (cart flow — all categories share the same event)
  const firstCat = categories[0];
  if (firstCat && firstCat.event.eventType === "FREE" && firstCat.event.attendeeCap !== null) {
    const totalSoldAgg = await db.ticketCategory.aggregate({
      where: { eventId: firstCat.event.id, isComplimentary: false },
      _sum: { soldQuantity: true },
    });
    const totalSold = totalSoldAgg._sum.soldQuantity ?? 0;
    const cartTotal = input.items.reduce((s, i) => s + Math.max(1, i.quantity), 0);
    const remainingInTier = Math.max(0, firstCat.event.attendeeCap - totalSold);
    if (cartTotal > remainingInTier) {
      if (remainingInTier === 0) {
        return { ok: false, error: "This event has reached its registration limit." };
      }
      return { ok: false, error: `Only ${remainingInTier} spot${remainingInTier > 1 ? "s" : ""} left in the current tier.` };
    }
  }

  const enriched = input.items.map((item) => {
    const cat = categories.find((c) => c.id === item.ticketCategoryId)!;
    const quantity = Math.max(1, item.quantity);
    return { ticketCategoryId: item.ticketCategoryId, cat, quantity, totalAmount: Number(cat.price) * quantity };
  });
  const grandTotal = enriched.reduce((sum, i) => sum + i.totalAmount, 0);

  // Free event bypass — skip payment entirely
  if (grandTotal === 0) {
    const buyer = await db.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { email: true, name: true },
    });
    const result: Array<{ name: string; quantity: number; ticketNumbers: string[] }> = [];

    try {
      await db.$transaction(async (tx) => {
        for (const item of enriched) {
          const reserved = await tx.$executeRaw`
            UPDATE "TicketCategory"
            SET "soldQuantity" = "soldQuantity" + ${item.quantity}
            WHERE id = ${item.ticketCategoryId} AND "soldQuantity" + ${item.quantity} <= "totalQuantity"
          `;
          if (reserved === 0) throw new Error("SOLD_OUT:" + item.cat.name);

          const prefix = item.cat.event.title.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "X");
          const order = await tx.order.create({
            data: {
              buyerId: session.user.id,
              ticketCategoryId: item.ticketCategoryId,
              quantity: item.quantity,
              totalAmount: 0,
              paidAmount: 0,
              status: "PAID_IN_FULL",
              usesInstallments: false,
              ...(input.inviteToken ? { inviteSource: "LINK" } : {}),
            },
          });
          await tx.installmentPayment.create({
            data: {
              orderId: order.id,
              paymentNumber: 0,
              amount: 0,
              dueDate: new Date(),
              status: "PAID",
            },
          });
          const ticketNumbers: string[] = [];
          for (let i = 0; i < item.quantity; i++) {
            const num = generateTicketNumber(prefix);
            ticketNumbers.push(num);
            await tx.ticket.create({
              data: { orderId: order.id, ticketCategoryId: item.ticketCategoryId, ticketNumber: num },
            });
          }
          result.push({ name: item.cat.name, quantity: item.quantity, ticketNumbers });
        }
      });
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("SOLD_OUT:"))
        return { ok: false, error: `${err.message.slice("SOLD_OUT:".length)} is sold out.` };
      throw err;
    }

    const firstCatForEmail = enriched[0].cat;
    if (result.length === 1) {
      await sendTicketConfirmation({
        to: buyer.email,
        name: buyer.name ?? buyer.email,
        eventTitle: firstCatForEmail.event.title,
        categoryName: result[0].name,
        ticketNumbers: result[0].ticketNumbers,
        eventDate: firstCatForEmail.event.date.toISOString(),
        venue: firstCatForEmail.event.venue,
      });
    } else {
      await sendCartConfirmation({
        to: buyer.email,
        name: buyer.name ?? buyer.email,
        eventTitle: firstCatForEmail.event.title,
        eventDate: firstCatForEmail.event.date.toISOString(),
        venue: firstCatForEmail.event.venue,
        categories: result,
      });
    }

    if (input.inviteToken) {
      await db.privateEventToken.updateMany({
        where: { token: input.inviteToken },
        data: { useCount: { increment: 1 } },
      });
    }

    const allTicketNumbers = result.flatMap((r) => r.ticketNumbers);
    return { ok: true, data: { paymentUrl: `${process.env.NEXT_PUBLIC_APP_URL}/buyer`, ticketNumbers: allTicketNumbers } };
  }

  const reference = generateReference("LUM");

  const orderIds = await db.$transaction(async (tx) => {
    const ids: string[] = [];

    for (const item of enriched) {
      const order = await tx.order.create({
        data: {
          buyerId: session.user.id,
          ticketCategoryId: item.ticketCategoryId,
          quantity: item.quantity,
          totalAmount: item.totalAmount,
          paidAmount: 0,
          status: "PENDING",
          usesInstallments: false,
          ...(input.inviteToken ? { inviteSource: "LINK" } : {}),
        },
      });
      ids.push(order.id);

      await tx.installmentPayment.create({
        data: {
          orderId: order.id,
          paymentNumber: 0,
          amount: item.totalAmount,
          dueDate: new Date(),
          status: "PENDING",
        },
      });
    }

    await tx.paymentTransaction.create({
      data: {
        orderId: ids[0],
        amount: grandTotal,
        reference,
        status: "pending",
        metadata: { orderIds: ids, isCart: true, paymentNumber: 0, ...(input.inviteToken ? { inviteToken: input.inviteToken } : {}) },
      },
    });

    return ids;
  });

  const buyer = await db.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { email: true },
  });

  const payment = await initializePayment({
    email: buyer.email,
    amount: grandTotal,
    reference,
    redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/callback?reference=${reference}`,
  });

  if (!payment.ok) {
    await db.$transaction(async (tx) => {
      await tx.paymentTransaction.deleteMany({ where: { reference } });
      await tx.installmentPayment.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.order.deleteMany({ where: { id: { in: orderIds } } });
    });
    return { ok: false, error: "Failed to initialise payment. Please try again." };
  }

  await db.paymentTransaction.updateMany({
    where: { reference },
    data: { providerRef: payment.invoiceId },
  });

  return { ok: true, data: { paymentUrl: payment.url } };
}

export async function payInstallment(
  orderId: string,
  options: {
    mode: "installment" | "complete" | "custom";
    customAmount?: number;
  } = { mode: "installment" }
): Promise<ApiResponse<{ paymentUrl: string }>> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Please sign in to continue." };

  const order = await db.order.findFirst({
    where: { id: orderId, buyerId: session.user.id },
    include: {
      payments: { orderBy: { paymentNumber: "asc" } },
      buyer: { select: { email: true } },
      ticketCategory: { include: { event: true } },
    },
  });

  if (!order) return { ok: false, error: "Order not found." };
  if (order.status !== "PARTIAL_PAID") return { ok: false, error: "No installment payment is due for this order." };

  const nextPayment = order.payments.find(
    (p) => p.paymentNumber > 0 && p.status === "PENDING"
  );
  if (!nextPayment) return { ok: false, error: "No pending installment found." };

  const remainingAmount = Number(order.totalAmount) - Number(order.paidAmount);
  const { mode, customAmount } = options;

  let chargeAmount: number;
  let installmentPaymentId: string | null = null;

  if (mode === "installment") {
    chargeAmount = Number(nextPayment.amount) - Number(nextPayment.paidAmount);
    installmentPaymentId = nextPayment.id;
  } else if (mode === "complete") {
    chargeAmount = remainingAmount;
  } else {
    if (!customAmount || customAmount <= 0)
      return { ok: false, error: "Enter a valid amount." };
    if (customAmount > remainingAmount + 0.01)
      return { ok: false, error: `Amount cannot exceed the remaining balance of KES ${remainingAmount.toLocaleString()}.` };
    chargeAmount = customAmount;
  }

  const reference = generateReference("LUM");

  const { convenienceFee } = await getPlatformConfig();
  const totalChargeAmount = chargeAmount + convenienceFee;

  await db.paymentTransaction.create({
    data: {
      orderId: order.id,
      installmentPaymentId,
      amount: totalChargeAmount,
      reference,
      status: "pending",
      metadata: {
        orderId: order.id,
        paymentNumber: nextPayment.paymentNumber,
        paymentMode: mode,
        isFollowOn: true,
        ticketAmount: chargeAmount,
        convenienceFee,
      },
    },
  });

  const payment = await initializePayment({
    email: order.buyer.email,
    amount: totalChargeAmount,
    reference,
    redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/callback?reference=${reference}`,
  });

  if (!payment.ok) {
    await db.paymentTransaction.delete({ where: { reference } });
    return { ok: false, error: "Failed to initialise payment. Please try again." };
  }

  await db.paymentTransaction.updateMany({
    where: { reference },
    data: { providerRef: payment.invoiceId },
  });

  return { ok: true, data: { paymentUrl: payment.url } };
}

// Fallback for when the IntaSend webhook doesn't reach the server (e.g. local dev).
// Called by the callback page after direct payment verification with IntaSend.
// Uses the same idempotency guard as the webhook — safe to call even if the webhook also fires.
export async function finalizeOrderFromCallback(
  reference: string,
  amountNaira: number
): Promise<ApiResponse<{ isPartial: boolean }>> {
  // Idempotency guard — only proceed if transaction is still pending
  const claimed = await db.paymentTransaction.updateMany({
    where: { reference, status: "pending" },
    data: { status: "processing" },
  });
  if (claimed.count === 0) {
    return { ok: true, data: { isPartial: false } }; // already handled by webhook
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

  if (!transaction?.order) return { ok: false, error: "Transaction not found." };

  const { order } = transaction;
  const { buyer, ticketCategory } = order;
  const event_ = ticketCategory.event;
  const txMeta = transaction.metadata as Record<string, unknown> | null;
  const paymentMode = (txMeta?.paymentMode as string) ?? "installment";
  const isFollowOnPayment = !!transaction.installmentPaymentId || txMeta?.isFollowOn === true;
  // Use only the ticket portion (excludes convenience fee and installment fee)
  const ticketAmount = typeof txMeta?.ticketAmount === "number" ? txMeta.ticketAmount : amountNaira;

  await db.$transaction(async (tx) => {
    await tx.paymentTransaction.update({ where: { reference }, data: { status: "success" } });

    if (paymentMode === "complete") {
      for (const payment of order.payments.filter((p) => p.paymentNumber > 0 && (p.status === "PENDING" || p.status === "OVERDUE"))) {
        await tx.installmentPayment.update({ where: { id: payment.id }, data: { status: "PAID", paidAt: new Date(), paidAmount: payment.amount } });
      }
    } else if (paymentMode === "custom") {
      let remaining = ticketAmount;
      for (const payment of order.payments.filter((p) => p.paymentNumber > 0 && p.status === "PENDING")) {
        const stillOwed = Number(payment.amount) - Number(payment.paidAmount);
        if (remaining >= stillOwed - 0.01) {
          await tx.installmentPayment.update({ where: { id: payment.id }, data: { status: "PAID", paidAt: new Date(), paidAmount: payment.amount } });
          remaining -= stillOwed;
          if (remaining <= 0) break;
        } else {
          await tx.installmentPayment.update({ where: { id: payment.id }, data: { paidAmount: { increment: remaining } } });
          break;
        }
      }
    } else if (isFollowOnPayment && transaction.installmentPaymentId) {
      const installment = order.payments.find((p) => p.id === transaction.installmentPaymentId);
      await tx.installmentPayment.update({ where: { id: transaction.installmentPaymentId }, data: { status: "PAID", paidAt: new Date(), paidAmount: installment?.amount } });
    } else {
      const initialPayment = order.payments.find((p) => p.paymentNumber === 0);
      if (initialPayment && initialPayment.status !== "PAID") {
        await tx.installmentPayment.update({ where: { id: initialPayment.id }, data: { status: "PAID", paidAt: new Date(), paidAmount: initialPayment.amount } });
      }
    }

    const newPaidAmount = Number(order.paidAmount) + ticketAmount;
    const isFullyPaid = newPaidAmount >= Number(order.totalAmount) - 0.01;

    await tx.order.update({ where: { id: order.id }, data: { paidAmount: newPaidAmount, status: isFullyPaid ? "PAID_IN_FULL" : "PARTIAL_PAID" } });

    if (!isFollowOnPayment) {
      await tx.ticketCategory.update({ where: { id: ticketCategory.id }, data: { soldQuantity: { increment: order.quantity } } });
    }

    if (!isFollowOnPayment && order.tickets.length === 0 && event_.experienceType !== "GROUP_TRIP") {
      const prefix = event_.title.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 4);
      for (let i = 0; i < order.quantity; i++) {
        await tx.ticket.create({
          data: { orderId: order.id, ticketCategoryId: ticketCategory.id, ticketNumber: generateTicketNumber(prefix), status: "ACTIVE", currentOwnerId: buyer.id },
        });
      }
    }
  });

  const updatedOrder = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { tickets: true, payments: true } });
  const isFullyPaid = Number(updatedOrder.paidAmount) >= Number(updatedOrder.totalAmount) - 0.01;

  try {
    const { format } = await import("date-fns");
    const eventDate = format(event_.date, "EEEE, dd MMMM yyyy · HH:mm");
    const venue = `${event_.venue}${event_.city ? `, ${event_.city}` : ""}`;

    if (event_.experienceType === "GROUP_TRIP") {
      if (!isFollowOnPayment || isFullyPaid) {
        await sendBookingConfirmation({ to: buyer.email, name: buyer.name ?? "there", eventTitle: event_.title, categoryName: ticketCategory.name, quantity: order.quantity, totalAmount: Number(order.totalAmount), paidAmount: Number(updatedOrder.paidAmount), eventDate, venue });
      } else {
        const remainingPayments = updatedOrder.payments.filter((p) => p.paymentNumber > 0 && p.status === "PENDING").map((p) => ({ installmentNumber: p.paymentNumber, amount: Number(p.amount) - Number(p.paidAmount), dueDate: format(p.dueDate, "dd MMM yyyy") }));
        await sendInstallmentReceipt({ to: buyer.email, name: buyer.name ?? "there", eventTitle: event_.title, categoryName: ticketCategory.name, eventDate, venue, amountPaid: amountNaira, totalPaid: Number(updatedOrder.paidAmount), totalAmount: Number(order.totalAmount), remainingPayments, isDeposit: false });
      }
    } else if (isFullyPaid) {
      await sendTicketConfirmation({ to: buyer.email, name: buyer.name ?? "there", eventTitle: event_.title, categoryName: ticketCategory.name, ticketNumbers: updatedOrder.tickets.map((t) => t.ticketNumber), eventDate, venue });
    } else {
      const remainingPayments = updatedOrder.payments
        .filter((p) => p.paymentNumber > 0 && p.status === "PENDING")
        .map((p) => ({ installmentNumber: p.paymentNumber, amount: Number(p.amount) - Number(p.paidAmount), dueDate: format(p.dueDate, "dd MMM yyyy") }));
      await sendInstallmentReceipt({ to: buyer.email, name: buyer.name ?? "there", eventTitle: event_.title, categoryName: ticketCategory.name, eventDate, venue, amountPaid: amountNaira, totalPaid: Number(updatedOrder.paidAmount), totalAmount: Number(order.totalAmount), remainingPayments, isDeposit: !isFollowOnPayment });
    }
  } catch (err) {
    console.error("[finalizeOrderFromCallback] email threw:", err);
  }

  return { ok: true, data: { isPartial: !isFullyPaid } };
}
