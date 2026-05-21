"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getKenyanBanks, type IntaSendBank } from "@/lib/intasend";
import { getPlatformConfig, computeSellerNet } from "@/lib/platformConfig";
import type { ApiResponse } from "@/types";

export type PayoutMethodData = {
  id: string;
  label: string | null;
  bankName: string;
  bankCode: string;
  bankType: string;
  accountNumber: string;
  accountName: string | null;
};

export async function getPayoutMethods(): Promise<PayoutMethodData[]> {
  const session = await auth();
  if (!session?.user) return [];

  const methods = await db.payoutMethod.findMany({
    where: { sellerId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  return methods.map((m) => ({
    id: m.id,
    label: m.label,
    bankName: m.bankName,
    bankCode: m.bankCode,
    bankType: m.bankType,
    accountNumber: m.accountNumber,
    accountName: m.accountName,
  }));
}

export async function fetchBanks(): Promise<ApiResponse<IntaSendBank[]>> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Please sign in." };
  return { ok: true, data: getKenyanBanks() };
}

export async function savePayoutMethod(input: {
  label?: string;
  bankCode: string;
  bankName: string;
  bankType: string;
  accountNumber: string;
  accountName: string;
}): Promise<ApiResponse<{ id: string }>> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Please sign in." };

  if (!input.bankCode || !input.accountNumber) {
    return { ok: false, error: "Bank and account number are required." };
  }

  const method = await db.payoutMethod.create({
    data: {
      sellerId: session.user.id,
      label: input.label || null,
      bankCode: input.bankCode,
      bankName: input.bankName,
      bankType: input.bankType,
      accountNumber: input.accountNumber,
      accountName: input.accountName || null,
    },
  });

  return { ok: true, data: { id: method.id } };
}

export async function updatePayoutMethod(
  id: string,
  input: {
    label?: string;
    bankCode: string;
    bankName: string;
    bankType: string;
    accountNumber: string;
    accountName: string;
  }
): Promise<ApiResponse<null>> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Please sign in." };

  const existing = await db.payoutMethod.findFirst({
    where: { id, sellerId: session.user.id },
  });
  if (!existing) return { ok: false, error: "Payout method not found." };

  await db.payoutMethod.update({
    where: { id },
    data: {
      label: input.label || null,
      bankCode: input.bankCode,
      bankName: input.bankName,
      bankType: input.bankType,
      accountNumber: input.accountNumber,
      accountName: input.accountName || null,
    },
  });

  return { ok: true, data: null };
}

export async function deletePayoutMethod(id: string): Promise<ApiResponse<null>> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Please sign in." };

  const existing = await db.payoutMethod.findFirst({
    where: { id, sellerId: session.user.id },
  });
  if (!existing) return { ok: false, error: "Payout method not found." };

  await db.event.updateMany({
    where: { payoutMethodId: id },
    data: { payoutMethodId: null },
  });

  await db.payoutMethod.delete({ where: { id } });

  return { ok: true, data: null };
}

// ─── Disbursements ────────────────────────────────────────────────────────────

export type DisbursementData = {
  grossRevenue: number;
  platformFee: number;
  earned: number;
  paidOut: number;
  outstanding: number;
  history: {
    id: string;
    amount: number;
    status: string;
    reference: string;
    createdAt: Date;
    reason: string | null;
    payoutMethod: { bankName: string; accountNumber: string; bankType: string } | null;
  }[];
  payoutMethods: PayoutMethodData[];
};

export async function getDisbursementData(): Promise<ApiResponse<DisbursementData>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "SELLER") return { ok: false, error: "Unauthorized." };
  const sellerId = session.user.id;

  const [orders, payoutRecords, payoutMethods, platformConfig] = await Promise.all([
    db.order.findMany({
      where: { status: { in: ["PAID_IN_FULL", "PARTIAL_PAID"] }, ticketCategory: { event: { sellerId } } },
      select: {
        paidAmount: true,
        ticketCategory: {
          select: {
            event: {
              select: {
                eventType: true,
                experienceType: true,
                platformFeePercent: true,
                platformFlatFee: true,
              },
            },
          },
        },
      },
    }),
    db.payout.findMany({
      where: { sellerId },
      orderBy: { createdAt: "desc" },
      include: {
        payoutMethod: {
          select: { bankName: true, accountNumber: true, bankType: true },
        },
      },
    }),
    db.payoutMethod.findMany({ where: { sellerId }, orderBy: { createdAt: "asc" } }),
    getPlatformConfig(),
  ]);

  let totalGross = 0;
  let totalSellerNet = 0;
  let totalPlatformFee = 0;

  for (const order of orders) {
    const ev = order.ticketCategory.event;
    const orderGross = Number(order.paidAmount);
    const { sellerNet, platformFee } = computeSellerNet(
      orderGross,
      ev.eventType,
      ev.experienceType,
      ev.platformFeePercent,
      platformConfig,
    );
    totalGross += orderGross;
    totalSellerNet += sellerNet;
    totalPlatformFee += platformFee;
  }

  const totalPaidOut = payoutRecords
    .filter((p) => p.status === "success")
    .reduce((s, p) => s + Number(p.amount), 0);

  return {
    ok: true,
    data: {
      grossRevenue: Math.round(totalGross * 100) / 100,
      platformFee: Math.round(totalPlatformFee * 100) / 100,
      earned: Math.round(totalSellerNet * 100) / 100,
      paidOut: Math.round(totalPaidOut * 100) / 100,
      outstanding: Math.max(0, Math.round((totalSellerNet - totalPaidOut) * 100) / 100),
      history: payoutRecords.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        status: p.status,
        reference: p.reference,
        createdAt: p.createdAt,
        reason: p.reason,
        payoutMethod: p.payoutMethod ?? null,
      })),
      payoutMethods: payoutMethods.map((m) => ({
        id: m.id,
        label: m.label,
        bankName: m.bankName,
        bankCode: m.bankCode,
        bankType: m.bankType,
        accountNumber: m.accountNumber,
        accountName: m.accountName,
      })),
    },
  };
}

export async function requestDisbursement(): Promise<ApiResponse<null>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "SELLER") return { ok: false, error: "Unauthorized." };

  const result = await getDisbursementData();
  if (!result.ok) return { ok: false, error: result.error };

  const { outstanding, earned, paidOut, payoutMethods } = result.data;

  if (outstanding < 1) return { ok: false, error: "No outstanding balance to disburse." };
  if (payoutMethods.length === 0) {
    return { ok: false, error: "Add a payout method in Settings before requesting a disbursement." };
  }

  const pm = payoutMethods[0];
  const { sendDisbursementRequestNotice } = await import("@/lib/email");

  try {
    await sendDisbursementRequestNotice({
      sellerName: session.user.name ?? "Unknown seller",
      sellerEmail: session.user.email ?? "",
      outstanding,
      earned,
      paidOut,
      payoutMethod: {
        bankName: pm.bankName,
        accountNumber: pm.accountNumber,
        bankType: pm.bankType,
        label: pm.label,
      },
    });
  } catch (err) {
    console.error("[requestDisbursement] email failed:", err);
    return { ok: false, error: "Failed to send request. Please try again." };
  }

  return { ok: true, data: null };
}
