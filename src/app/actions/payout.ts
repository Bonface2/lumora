"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  getBanks,
  resolveAccount,
  createTransferRecipient,
  type PaystackBank,
} from "@/lib/paystack";
import type { ApiResponse } from "@/types";

export type PayoutMethodData = {
  id: string;
  label: string | null;
  paystackBankName: string;
  paystackBankCode: string;
  bankType: string;
  paystackAccountNumber: string;
  paystackAccountName: string | null;
  paystackRecipientCode: string;
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
    paystackBankName: m.paystackBankName,
    paystackBankCode: m.paystackBankCode,
    bankType: m.bankType,
    paystackAccountNumber: m.paystackAccountNumber,
    paystackAccountName: m.paystackAccountName,
    paystackRecipientCode: m.paystackRecipientCode,
  }));
}

export async function fetchBanks(): Promise<ApiResponse<PaystackBank[]>> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Please sign in." };

  try {
    const banks = await getBanks();
    return { ok: true, data: banks };
  } catch {
    return { ok: false, error: "Could not load banks. Please try again." };
  }
}

export async function verifyAccountNumber(
  accountNumber: string,
  bankCode: string
): Promise<ApiResponse<{ accountName: string }>> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Please sign in." };

  if (!/^\d{6,20}$/.test(accountNumber.trim())) {
    return { ok: false, error: "Enter a valid account number." };
  }

  try {
    const result = await resolveAccount(accountNumber.trim(), bankCode);
    return { ok: true, data: result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    const lower = msg.toLowerCase();
    if (lower.includes("too many") || lower.includes("rate limit") || lower.includes("429")) {
      return { ok: false, error: "Too many verification attempts — please wait a few minutes and try again." };
    }
    if (msg) return { ok: false, error: msg };
    return { ok: false, error: "Could not verify account. Check the number and bank, then try again." };
  }
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

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });
  if (!user) return { ok: false, error: "User not found." };

  const isPaybill = input.bankCode === "MPPAYBILL";
  const isMobileBusiness = input.bankType === "mobile_money_business";
  const recipientName = isMobileBusiness
    ? (user.name || user.email)
    : (input.accountName || user.name || user.email);

  try {
    const { recipientCode } = await createTransferRecipient({
      type: input.bankType,
      name: recipientName,
      accountNumber: input.accountNumber,
      bankCode: input.bankCode,
    });

    const method = await db.payoutMethod.create({
      data: {
        sellerId: session.user.id,
        label: input.label || null,
        paystackRecipientCode: recipientCode,
        paystackBankCode: input.bankCode,
        paystackBankName: input.bankName,
        bankType: input.bankType,
        paystackAccountNumber: input.accountNumber,
        paystackAccountName: isPaybill ? input.accountName : (recipientName ?? null),
      },
    });

    return { ok: true, data: { id: method.id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to set up payout account." };
  }
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

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });
  if (!user) return { ok: false, error: "User not found." };

  const isPaybill = input.bankCode === "MPPAYBILL";
  const isMobileBusiness = input.bankType === "mobile_money_business";
  const recipientName = isMobileBusiness
    ? (user.name || user.email)
    : (input.accountName || user.name || user.email);

  try {
    const { recipientCode } = await createTransferRecipient({
      type: input.bankType,
      name: recipientName,
      accountNumber: input.accountNumber,
      bankCode: input.bankCode,
    });

    await db.payoutMethod.update({
      where: { id },
      data: {
        label: input.label || null,
        paystackRecipientCode: recipientCode,
        paystackBankCode: input.bankCode,
        paystackBankName: input.bankName,
        bankType: input.bankType,
        paystackAccountNumber: input.accountNumber,
        paystackAccountName: isPaybill ? input.accountName : (recipientName ?? null),
      },
    });

    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to update payout account." };
  }
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
