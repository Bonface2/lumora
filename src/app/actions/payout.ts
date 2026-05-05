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

export async function getPayoutAccount(): Promise<{
  accountName: string | null;
  accountNumber: string | null;
  bankName: string | null;
  bankType: string | null;
  recipientCode: string | null;
}> {
  const session = await auth();
  if (!session?.user) {
    return { accountName: null, accountNumber: null, bankName: null, bankType: null, recipientCode: null };
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      paystackAccountName: true,
      paystackAccountNumber: true,
      paystackBankName: true,
      paystackBankCode: true,
      paystackRecipientCode: true,
    },
  });

  // Derive bankType from stored bankCode by checking the known mobile money codes
  const mobileMoneyCodes = new Set(["MPESA", "ATL_KE", "97", "MPPAYBILL", "MPTILL"]);
  const bankType = user?.paystackBankCode
    ? mobileMoneyCodes.has(user.paystackBankCode) ? "mobile_money" : "kepss"
    : null;

  return {
    accountName: user?.paystackAccountName ?? null,
    accountNumber: user?.paystackAccountNumber ?? null,
    bankName: user?.paystackBankName ?? null,
    bankType,
    recipientCode: user?.paystackRecipientCode ?? null,
  };
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
  } catch {
    return { ok: false, error: "Account not found. Check the number and bank, then try again." };
  }
}

export async function deletePayoutAccount(): Promise<ApiResponse<null>> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Please sign in." };

  await db.user.update({
    where: { id: session.user.id },
    data: {
      paystackRecipientCode: null,
      paystackBankCode: null,
      paystackBankName: null,
      paystackAccountNumber: null,
      paystackAccountName: null,
    },
  });

  return { ok: true, data: null };
}

export async function savePayoutAccount(input: {
  bankCode: string;
  bankName: string;
  bankType: string;
  accountNumber: string;
  accountName: string;
}): Promise<ApiResponse<{ recipientCode: string }>> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Please sign in." };

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });
  if (!user) return { ok: false, error: "User not found." };

  // For paybill/till, accountName holds the account ref — use seller's profile name for Paystack
  const recipientName = input.bankType === "mobile_money_business"
    ? (user.name || user.email)
    : (input.accountName || user.name || user.email);

  try {
    const { recipientCode } = await createTransferRecipient({
      type: input.bankType,
      name: recipientName,
      accountNumber: input.accountNumber,
      bankCode: input.bankCode,
    });

    await db.user.update({
      where: { id: session.user.id },
      data: {
        paystackRecipientCode: recipientCode,
        paystackBankCode: input.bankCode,
        paystackBankName: input.bankName,
        paystackAccountNumber: input.accountNumber,
        paystackAccountName: recipientName,
      },
    });

    return { ok: true, data: { recipientCode } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to set up payout account." };
  }
}
