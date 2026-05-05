"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { initiateTransfer, toKobo, generateReference, PLATFORM_FEE_PERCENT } from "@/lib/paystack";
import type { ApiResponse } from "@/types";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session.user;
}

// ─── Event fee management ──────────────────────────────────────────────────────

export async function setEventPlatformFee(
  eventId: string,
  feePercent: number | null
): Promise<ApiResponse<null>> {
  if (!(await requireAdmin())) return { ok: false, error: "Unauthorized." };

  if (feePercent !== null && (feePercent < 0 || feePercent > 100)) {
    return { ok: false, error: "Fee must be between 0 and 100." };
  }

  await db.event.update({
    where: { id: eventId },
    data: { platformFeePercent: feePercent },
  });

  return { ok: true, data: null };
}

export async function getAdminEvent(eventId: string) {
  if (!(await requireAdmin())) return null;

  return db.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      date: true,
      venue: true,
      status: true,
      platformFeePercent: true,
      seller: { select: { name: true, email: true } },
    },
  });
}

// ─── Payout management ────────────────────────────────────────────────────────

export async function getSellerBalances() {
  if (!(await requireAdmin())) return [];

  // All fully-paid orders with their event's fee rate
  const orders = await db.order.findMany({
    where: { status: "PAID_IN_FULL" },
    select: {
      totalAmount: true,
      ticketCategory: {
        select: {
          event: {
            select: {
              sellerId: true,
              platformFeePercent: true,
              seller: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  paystackRecipientCode: true,
                  paystackBankName: true,
                  paystackAccountNumber: true,
                  paystackBankCode: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // Aggregate earnings per seller
  const earnings: Record<string, number> = {};
  const sellers: Record<string, {
    id: string;
    name: string | null;
    email: string;
    recipientCode: string | null;
    bankName: string | null;
    accountNumber: string | null;
    bankCode: string | null;
  }> = {};

  for (const order of orders) {
    const event = order.ticketCategory.event;
    const seller = event.seller;
    const feePercent = Number(event.platformFeePercent ?? PLATFORM_FEE_PERCENT);
    const sellerShare = Number(order.totalAmount) * (1 - feePercent / 100);

    earnings[seller.id] = (earnings[seller.id] ?? 0) + sellerShare;
    sellers[seller.id] = {
      id: seller.id,
      name: seller.name,
      email: seller.email,
      recipientCode: seller.paystackRecipientCode,
      bankName: seller.paystackBankName,
      accountNumber: seller.paystackAccountNumber,
      bankCode: seller.paystackBankCode,
    };
  }

  // Successful payouts already sent
  const payouts = await db.payout.findMany({
    where: { status: "success" },
    select: { sellerId: true, amount: true },
  });
  const paidOut: Record<string, number> = {};
  for (const p of payouts) {
    paidOut[p.sellerId] = (paidOut[p.sellerId] ?? 0) + Number(p.amount);
  }

  return Object.entries(earnings)
    .map(([sellerId, earned]) => ({
      seller: sellers[sellerId],
      earned: Math.round(earned * 100) / 100,
      paidOut: Math.round((paidOut[sellerId] ?? 0) * 100) / 100,
      outstanding: Math.round((earned - (paidOut[sellerId] ?? 0)) * 100) / 100,
    }))
    .filter((b) => b.outstanding > 0.5) // ignore dust amounts
    .sort((a, b) => b.outstanding - a.outstanding);
}

export async function triggerSellerPayout(
  sellerId: string,
  amount: number
): Promise<ApiResponse<{ payoutId: string }>> {
  if (!(await requireAdmin())) return { ok: false, error: "Unauthorized." };

  if (amount <= 0) return { ok: false, error: "Amount must be greater than zero." };

  const seller = await db.user.findUnique({
    where: { id: sellerId },
    select: { paystackRecipientCode: true, name: true, email: true },
  });
  if (!seller?.paystackRecipientCode) {
    return { ok: false, error: "Seller has not set up a payout account." };
  }

  const reference = generateReference("PAY");

  const payout = await db.payout.create({
    data: {
      sellerId,
      amount,
      reference,
      status: "pending",
      reason: `Lumora ticket sales payout`,
    },
  });

  try {
    const transfer = await initiateTransfer({
      amount: toKobo(amount),
      recipient: seller.paystackRecipientCode,
      reference,
      reason: `Lumora payout — ${seller.name ?? seller.email}`,
    });

    await db.payout.update({
      where: { id: payout.id },
      data: { paystackRef: transfer.transferCode, status: transfer.status === "success" ? "success" : "pending" },
    });

    return { ok: true, data: { payoutId: payout.id } };
  } catch (err) {
    await db.payout.update({ where: { id: payout.id }, data: { status: "failed" } });
    return { ok: false, error: err instanceof Error ? err.message : "Transfer failed." };
  }
}
