const INTASEND_BASE_URL =
  process.env.INTASEND_TEST_MODE === "true"
    ? "https://sandbox.intasend.com"
    : "https://payment.intasend.com";

const INTASEND_SECRET_KEY = process.env.INTASEND_SECRET_KEY!;
const INTASEND_PUBLIC_KEY = process.env.NEXT_PUBLIC_INTASEND_PUBLIC_KEY!;

// authKey = null → no Authorization header (checkout endpoint identifies via public_key in body)
async function intasendRequest<T>(
  endpoint: string,
  body: Record<string, unknown>,
  authKey: string | null = INTASEND_SECRET_KEY
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authKey) headers["Authorization"] = `Bearer ${authKey}`;
  const res = await fetch(`${INTASEND_BASE_URL}${endpoint}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    const detail = data.errors?.[0]?.detail ?? data.detail ?? data.message ?? "IntaSend request failed";
    throw new Error(detail);
  }
  return data as T;
}

export interface InitPaymentParams {
  email: string;
  amount: number; // KES — no cents conversion needed
  reference: string; // used as api_ref
  redirect_url: string;
  first_name?: string;
  last_name?: string;
}

interface IntaSendCheckoutResponse {
  id: string; // invoice_id
  url: string; // redirect the user here
  api_ref: string;
  state: string;
}

export interface InitPaymentResult {
  ok: boolean;
  url: string; // IntaSend hosted checkout URL
  invoiceId: string; // IntaSend invoice id — store as providerRef
}

export async function initializePayment(params: InitPaymentParams): Promise<InitPaymentResult> {
  try {
    const data = await intasendRequest<IntaSendCheckoutResponse>("/api/v1/checkout/", {
      public_key: INTASEND_PUBLIC_KEY,
      currency: "KES",
      amount: params.amount,
      email: params.email,
      api_ref: params.reference,
      redirect_url: params.redirect_url,
      ...(params.first_name ? { first_name: params.first_name } : {}),
      ...(params.last_name ? { last_name: params.last_name } : {}),
    }, null);
    return { ok: true, url: data.url, invoiceId: data.id };
  } catch (err) {
    console.error("[intasend] initializePayment error:", err);
    return { ok: false, url: "", invoiceId: "" };
  }
}

interface IntaSendStatusResponse {
  invoice: {
    invoice_id: string;
    state: string; // "COMPLETE" | "PENDING" | "FAILED" | "CANCELLED"
    amount: number; // KES
    api_ref: string;
    currency: string;
  };
}

export interface VerifyPaymentResult {
  verified: boolean;
  amount: number; // KES
  invoiceId: string;
  apiRef: string;
}

export async function verifyPayment(invoiceId: string): Promise<VerifyPaymentResult> {
  try {
    const data = await intasendRequest<IntaSendStatusResponse>("/api/v1/payment/status/", {
      invoice_id: invoiceId,
    });
    return {
      verified: data.invoice.state === "COMPLETE",
      amount: data.invoice.amount,
      invoiceId: data.invoice.invoice_id,
      apiRef: data.invoice.api_ref,
    };
  } catch {
    return { verified: false, amount: 0, invoiceId, apiRef: "" };
  }
}

export function generateReference(prefix = "LUM"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
}

// ─── Payouts / Send Money ─────────────────────────────────────────────────────

export type IntaSendProvider = "MPESA-B2C" | "MPESA-B2B" | "PESALINK";

export interface SendMoneyTransaction {
  name: string;
  account: string;
  amount: number; // KES
  narrative?: string;
  // MPESA-B2B only
  account_type?: "PayBill" | "TillNumber";
  account_reference?: string;
  // PESALINK only
  bank_code?: string;
}

interface SendMoneyResponse {
  tracking_id: string;
  status: string;
  transactions?: Array<{ status: string; tracking_id: string }>;
}

export async function sendMoney(params: {
  provider: IntaSendProvider;
  transactions: SendMoneyTransaction[];
  batch_reference?: string;
}): Promise<{ ok: boolean; trackingId: string }> {
  try {
    const data = await intasendRequest<SendMoneyResponse>("/api/v1/send-money/initiate/", {
      currency: "KES",
      provider: params.provider,
      requires_approval: "NO",
      batch_reference: params.batch_reference,
      transactions: params.transactions,
    });
    return { ok: true, trackingId: data.tracking_id };
  } catch (err) {
    console.error("[intasend] sendMoney error:", err);
    return { ok: false, trackingId: "" };
  }
}

export interface IntaSendBank {
  code: string;
  name: string;
  type: "mobile_money" | "mobile_money_business" | "bank";
}

// Static list of Kenyan banks and mobile money providers supported via IntaSend.
// Mobile money uses MPESA-B2C / MPESA-B2B providers.
// Banks use PESALINK.
export function getKenyanBanks(): IntaSendBank[] {
  return [
    // Mobile money
    { code: "MPESA", name: "M-PESA (personal)", type: "mobile_money" },
    { code: "MPPAYBILL", name: "M-PESA Paybill", type: "mobile_money_business" },
    // PesaLink banks (CBK codes)
    { code: "01", name: "KCB Bank", type: "bank" },
    { code: "68", name: "Equity Bank", type: "bank" },
    { code: "11", name: "Cooperative Bank", type: "bank" },
    { code: "02", name: "Standard Chartered Bank", type: "bank" },
    { code: "03", name: "ABSA Bank Kenya", type: "bank" },
    { code: "07", name: "NCBA Bank", type: "bank" },
    { code: "12", name: "National Bank of Kenya", type: "bank" },
    { code: "63", name: "Diamond Trust Bank", type: "bank" },
    { code: "31", name: "Stanbic Bank Kenya", type: "bank" },
    { code: "57", name: "I&M Bank", type: "bank" },
    { code: "70", name: "Family Bank", type: "bank" },
    { code: "72", name: "Gulf African Bank", type: "bank" },
    { code: "43", name: "Ecobank Kenya", type: "bank" },
    { code: "19", name: "Bank of Africa Kenya", type: "bank" },
    { code: "10", name: "Prime Bank", type: "bank" },
    { code: "76", name: "UBA Kenya Bank", type: "bank" },
    { code: "61", name: "HFC Limited", type: "bank" },
    { code: "25", name: "Credit Bank", type: "bank" },
    { code: "54", name: "Victoria Commercial Bank", type: "bank" },
    { code: "35", name: "African Banking Corporation", type: "bank" },
    { code: "74", name: "SBM Bank Kenya", type: "bank" },
    { code: "95", name: "Sidian Bank", type: "bank" },
    { code: "06", name: "Bank of Baroda Kenya", type: "bank" },
    { code: "16", name: "Citibank Kenya", type: "bank" },
    { code: "26", name: "Trans-National Bank", type: "bank" },
    { code: "55", name: "Guaranty Trust Bank", type: "bank" },
    { code: "49", name: "Consolidated Bank of Kenya", type: "bank" },
    { code: "50", name: "Paramount Bank", type: "bank" },
    { code: "66", name: "K-Rep Bank (Jitegemea)", type: "bank" },
  ];
}

export function getIntaSendProvider(bankType: string): IntaSendProvider {
  if (bankType === "mobile_money") return "MPESA-B2C";
  if (bankType === "mobile_money_business") return "MPESA-B2B";
  return "PESALINK"; // "bank" or legacy "kepss"
}
