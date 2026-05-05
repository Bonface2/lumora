const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;
const PAYSTACK_BASE_URL = "https://api.paystack.co";

export const PLATFORM_FEE_PERCENT = 6;

async function paystackRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${PAYSTACK_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message ?? "Paystack request failed");
  }

  return data as T;
}

export interface PaystackBank {
  id: number;
  name: string;
  code: string;
  type: string; // "kepss" | "mobile_money" | "mobile_money_business"
}

export async function getBanks(): Promise<PaystackBank[]> {
  const res = await paystackRequest<{ status: boolean; data: PaystackBank[] }>(
    "/bank?currency=KES&perPage=200"
  );
  return res.data;
}

export async function resolveAccount(
  accountNumber: string,
  bankCode: string
): Promise<{ accountName: string }> {
  const res = await paystackRequest<{ status: boolean; data: { account_name: string } }>(
    `/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`
  );
  return { accountName: res.data.account_name };
}

export interface CreateTransferRecipientParams {
  type: string;       // "mobile_money" | "kepss"
  name: string;
  accountNumber: string;
  bankCode: string;
}

export async function createTransferRecipient(
  params: CreateTransferRecipientParams
): Promise<{ recipientCode: string }> {
  const res = await paystackRequest<{ status: boolean; data: { recipient_code: string } }>(
    "/transferrecipient",
    {
      method: "POST",
      body: JSON.stringify({
        type: params.type,
        name: params.name,
        account_number: params.accountNumber,
        bank_code: params.bankCode,
        currency: "KES",
      }),
    }
  );
  return { recipientCode: res.data.recipient_code };
}

export async function initiateTransfer(params: {
  amount: number; // in cents
  recipient: string;
  reference: string;
  reason?: string;
}): Promise<{ transferCode: string; status: string }> {
  const res = await paystackRequest<{
    status: boolean;
    data: { transfer_code: string; status: string };
  }>("/transfer", {
    method: "POST",
    body: JSON.stringify({
      source: "balance",
      amount: params.amount,
      recipient: params.recipient,
      reference: params.reference,
      reason: params.reason ?? "Lumora ticket sales payout",
    }),
  });
  return { transferCode: res.data.transfer_code, status: res.data.status };
}

export interface InitializePaymentParams {
  email: string;
  amount: number; // in cents
  reference: string;
  metadata?: Record<string, unknown>;
  callback_url?: string;
}

export interface InitializePaymentResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export async function initializePayment(
  params: InitializePaymentParams
): Promise<InitializePaymentResponse> {
  return paystackRequest<InitializePaymentResponse>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export interface VerifyPaymentResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    status: "success" | "failed" | "abandoned";
    reference: string;
    amount: number;
    paid_at: string;
    customer: { email: string };
    metadata: Record<string, unknown>;
  };
}

export async function verifyPayment(
  reference: string
): Promise<VerifyPaymentResponse> {
  return paystackRequest<VerifyPaymentResponse>(
    `/transaction/verify/${reference}`
  );
}

export function generateReference(prefix = "LUM"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
}

export function toKobo(amount: number): number {
  return Math.round(amount * 100);
}

export function fromKobo(kobo: number): number {
  return kobo / 100;
}
