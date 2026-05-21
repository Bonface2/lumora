import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Paystack is no longer used. All payments and payouts now go through IntaSend.
// This route is kept as a stub so any stale webhook deliveries return 200
// instead of 404, preventing Paystack dashboard alerts.
export async function POST() {
  return NextResponse.json({ received: true });
}
