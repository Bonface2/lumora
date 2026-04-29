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

  // Option A: consolidate any past-due installments into the deposit
  const now = new Date();
  const pastDueItems = plan?.scheduleItems.filter((s) => s.dueDate <= now) ?? [];
  const pastDuePct = pastDueItems.reduce((sum, s) => sum + Number(s.percentage), 0);
  const initialPercent = plan ? Number(plan.initialPaymentPercent) + pastDuePct : 100;
  const amountDueNow = Math.round((totalAmount * initialPercent) / 100);

  const reference = generateReference("LUM");

  // Create order + initial payment record in one transaction
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

    // Create installment payment records
    if (plan) {
      // Payment 0: initial deposit
      await tx.installmentPayment.create({
        data: {
          orderId: newOrder.id,
          paymentNumber: 0,
          amount: amountDueNow,
          dueDate: new Date(),
          status: "PENDING",
        },
      });

      // Payments 1..n: future installments only (past-due ones rolled into deposit)
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
      // Full payment — single record
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

    // Create Paystack transaction record
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

  // Initialise Paystack payment
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

export async function payInstallment(
  orderId: string
): Promise<ApiResponse<{ paymentUrl: string }>> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Please sign in to continue." };

  const order = await db.order.findFirst({
    where: { id: orderId, buyerId: session.user.id },
    include: {
      payments: { orderBy: { paymentNumber: "asc" } },
      buyer: { select: { email: true } },
    },
  });

  if (!order) return { ok: false, error: "Order not found." };
  if (order.status !== "PARTIAL_PAID") return { ok: false, error: "No installment payment is due for this order." };

  const nextPayment = order.payments.find(
    (p) => p.paymentNumber > 0 && p.status === "PENDING"
  );
  if (!nextPayment) return { ok: false, error: "No pending installment found." };

  const reference = generateReference("LUM");

  await db.paystackTransaction.create({
    data: {
      orderId: order.id,
      installmentPaymentId: nextPayment.id,
      amount: nextPayment.amount,
      reference,
      status: "pending",
      metadata: {
        orderId: order.id,
        paymentNumber: nextPayment.paymentNumber,
      },
    },
  });

  const paystack = await initializePayment({
    email: order.buyer.email,
    amount: toKobo(Number(nextPayment.amount)),
    reference,
    callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/callback`,
    metadata: { orderId: order.id, paymentNumber: nextPayment.paymentNumber },
  });

  if (!paystack.status) {
    await db.paystackTransaction.delete({ where: { reference } });
    return { ok: false, error: "Failed to initialise payment. Please try again." };
  }

  return { ok: true, data: { paymentUrl: paystack.data.authorization_url } };
}
