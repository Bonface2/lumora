"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getBanks, resolveAccount, createSubaccount, type PaystackBank } from "@/lib/paystack";
import type { ApiResponse } from "@/types";

export async function getPayoutAccount(): Promise<{
  accountName: string | null;
  accountNumber: string | null;
  bankName: string | null;
  subaccountCode: string | null;
}> {
  const session = await auth();
  if (!session?.user) return { accountName: null, accountNumber: null, bankName: null, subaccountCode: null };

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      paystackAccountName: true,
      paystackAccountNumber: true,
      paystackBankName: true,
      paystackSubaccountCode: true,
    },
  });

  return {
    accountName: user?.paystackAccountName ?? null,
    accountNumber: user?.paystackAccountNumber ?? null,
    bankName: user?.paystackBankName ?? null,
    subaccountCode: user?.paystackSubaccountCode ?? null,
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

  if (!/^\d{10,16}$/.test(accountNumber.trim())) {
    return { ok: false, error: "Enter a valid account number." };
  }

  try {
    const result = await resolveAccount(accountNumber.trim(), bankCode);
    return { ok: true, data: result };
  } catch {
    return { ok: false, error: "Account not found. Check the number and bank, then try again." };
  }
}

export async function savePayoutAccount(input: {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}): Promise<ApiResponse<{ subaccountCode: string }>> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Please sign in." };

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });
  if (!user) return { ok: false, error: "User not found." };

  try {
    const { subaccountCode } = await createSubaccount({
      businessName: user.name ?? user.email,
      bankCode: input.bankCode,
      accountNumber: input.accountNumber,
    });

    await db.user.update({
      where: { id: session.user.id },
      data: {
        paystackSubaccountCode: subaccountCode,
        paystackBankCode: input.bankCode,
        paystackBankName: input.bankName,
        paystackAccountNumber: input.accountNumber,
        paystackAccountName: input.accountName,
      },
    });

    return { ok: true, data: { subaccountCode } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to set up payout account." };
  }
}
