"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  initializePayment,
  generateReference,
  toKobo,
} from "@/lib/paystack";
import type { ApiResponse } from "@/types";

export async function createOrder(input: {
  ticketCategoryId: string;
  useInstallments: boolean;
  quantity?: number;
}): Promise<ApiResponse<{ paymentUrl: string }>> {
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

  if (input.useInstallments && !category.allowInstallments) {
    return { ok: false, error: "Installments are not available for this ticket." };
  }

  const totalAmount = Number(category.price) * quantity;
  const plan = input.useInstallments ? category.installmentPlan : null;

  const now = new Date();
  const pastDueItems = plan?.scheduleItems.filter((s) => s.dueDate <= now) ?? [];
  const pastDuePct = pastDueItems.reduce((sum, s) => sum + Number(s.percentage), 0);
  const initialPercent = plan ? Number(plan.initialPaymentPercent) + pastDuePct : 100;
  const amountDueNow = Math.round((totalAmount * initialPercent) / 100);

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

    await tx.paystackTransaction.create({
      data: {
        orderId: newOrder.id,
        amount: amountDueNow,
        reference,
        status: "pending",
        metadata: {
          orderId: newOrder.id,
          ticketCategoryId: category.id,
          useInstallments: !!plan,
          paymentNumber: 0,
        },
      },
    });

    return newOrder;
  });

  const buyer = await db.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { email: true },
  });

  const paystack = await initializePayment({
    email: buyer.email,
    amount: toKobo(amountDueNow),
    reference,
    callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/callback`,
    metadata: { orderId: order.id, paymentNumber: 0 },
  });

  if (!paystack.status) {
    await db.order.delete({ where: { id: order.id } });
    return { ok: false, error: "Failed to initialise payment. Please try again." };
  }

  return { ok: true, data: { paymentUrl: paystack.data.authorization_url } };
}

export async function createCartOrder(input: {
  items: Array<{ ticketCategoryId: string; quantity: number }>;
}): Promise<ApiResponse<{ paymentUrl: string }>> {
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

  const enriched = input.items.map((item) => {
    const cat = categories.find((c) => c.id === item.ticketCategoryId)!;
    const quantity = Math.max(1, item.quantity);
    return { ticketCategoryId: item.ticketCategoryId, quantity, totalAmount: Number(cat.price) * quantity };
  });
  const grandTotal = enriched.reduce((sum, i) => sum + i.totalAmount, 0);
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

    await tx.paystackTransaction.create({
      data: {
        orderId: ids[0],
        amount: grandTotal,
        reference,
        status: "pending",
        metadata: { orderIds: ids, isCart: true, paymentNumber: 0 },
      },
    });

    return ids;
  });

  const buyer = await db.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { email: true },
  });

  const paystack = await initializePayment({
    email: buyer.email,
    amount: toKobo(grandTotal),
    reference,
    callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/callback`,
    metadata: { orderIds, isCart: true, paymentNumber: 0 },
  });

  if (!paystack.status) {
    await db.$transaction(async (tx) => {
      await tx.paystackTransaction.deleteMany({ where: { reference } });
      await tx.installmentPayment.deleteMany({ where: { orderId: { in: orderIds } } });
      await tx.order.deleteMany({ where: { id: { in: orderIds } } });
    });
    return { ok: false, error: "Failed to initialise payment. Please try again." };
  }

  return { ok: true, data: { paymentUrl: paystack.data.authorization_url } };
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

  await db.paystackTransaction.create({
    data: {
      orderId: order.id,
      installmentPaymentId,
      amount: chargeAmount,
      reference,
      status: "pending",
      metadata: {
        orderId: order.id,
        paymentNumber: nextPayment.paymentNumber,
        paymentMode: mode,
        isFollowOn: true,
      },
    },
  });

  const paystack = await initializePayment({
    email: order.buyer.email,
    amount: toKobo(chargeAmount),
    reference,
    callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/callback`,
    metadata: { orderId: order.id, paymentNumber: nextPayment.paymentNumber, paymentMode: mode },
  });

  if (!paystack.status) {
    await db.paystackTransaction.delete({ where: { reference } });
    return { ok: false, error: "Failed to initialise payment. Please try again." };
  }

  return { ok: true, data: { paymentUrl: paystack.data.authorization_url } };
}
