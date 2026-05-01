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

export interface InitializePaymentParams {
  email: string;
  amount: number; // in kobo
  reference: string;
  metadata?: Record<string, unknown>;
  callback_url?: string;
  subaccount?: string;
  bearer?: "account" | "subaccount";
  transaction_charge?: number; // fixed platform cut in cents (overrides subaccount's percentage_charge)
}

export interface PaystackBank {
  id: number;
  name: string;
  code: string;
}

export async function getBanks(): Promise<PaystackBank[]> {
  const res = await paystackRequest<{ status: boolean; data: PaystackBank[] }>(
    "/bank?country=ke&currency=KES&perPage=200"
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

export async function createSubaccount(params: {
  businessName: string;
  bankCode: string;
  accountNumber: string;
}): Promise<{ subaccountCode: string }> {
  const res = await paystackRequest<{ status: boolean; data: { subaccount_code: string } }>(
    "/subaccount",
    {
      method: "POST",
      body: JSON.stringify({
        business_name: params.businessName,
        bank_code: params.bankCode,
        account_number: params.accountNumber,
        percentage_charge: PLATFORM_FEE_PERCENT,
      }),
    }
  );
  return { subaccountCode: res.data.subaccount_code };
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

export function toKobo(naira: number): number {
  return Math.round(naira * 100);
}

export function fromKobo(kobo: number): number {
  return kobo / 100;
}
