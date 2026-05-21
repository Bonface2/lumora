import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/layouts/Footer";
import { getPlatformConfig } from "@/lib/platformConfig";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Pricing — Lumora" };

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-gray-100 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

type FeeVariant = "fee" | "free" | "info";

const variantCls: Record<FeeVariant, string> = {
  fee:  "bg-primary-50 text-primary-700 border border-primary-200",
  free: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  info: "bg-gray-100  text-gray-500    border border-gray-200",
};

function FeeRow({
  label,
  value,
  sub,
  variant = "fee",
}: {
  label: string;
  value: string;
  sub?: string;
  variant?: FeeVariant;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-4 border-b border-gray-50 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        {sub && <p className="mt-0.5 text-xs text-gray-400 leading-snug">{sub}</p>}
      </div>
      <span className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold tracking-wide whitespace-nowrap ${variantCls[variant]}`}>
        {value}
      </span>
    </div>
  );
}

function SectionHeader({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-4 mb-6">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-xl">
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-black tracking-tight text-gray-900">{title}</h2>
        <p className="mt-0.5 text-sm text-gray-500">{sub}</p>
      </div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 text-xs leading-relaxed text-gray-400">{children}</p>
  );
}

export default async function PricingPage() {
  const [config, feeTiers] = await Promise.all([
    getPlatformConfig(),
    db.platformFeeTier.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const {
    paidFeePercent,
    groupTripFlatFee,
    convenienceFee,
    installmentFeePercent,
    installmentFeeCap,
    transferFee,
  } = config;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Nav */}
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-gray-100 bg-white/95 backdrop-blur-sm px-6 py-4 md:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/logo-light.svg" alt="Lumora" className="h-8 w-8 rounded-lg object-cover" />
          <span className="text-lg font-black tracking-tight text-gray-900">Lumora</span>
        </Link>
        <div className="hidden items-center gap-6 md:flex">
          <Link href="/events" className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors">Explore</Link>
          <Link href="/register?role=seller" className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors">List an experience</Link>
        </div>
        <Link href="/login" className="rounded-xl bg-primary-600 px-5 py-2 text-sm font-bold tracking-wide text-white hover:bg-primary-700 transition-colors">
          Log in
        </Link>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gray-950 px-6 py-14 md:px-10 md:py-20">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: "radial-gradient(circle, #16b5b8 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />
        <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[600px] -translate-x-1/2 rounded-full bg-primary-500/20 blur-[100px]" />
        <div className="relative mx-auto max-w-3xl text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary-400">Pricing</p>
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">Simple, transparent fees</h1>
          <p className="mt-4 text-base text-gray-400 max-w-xl mx-auto leading-relaxed">
            No monthly subscription. No setup fee. You only pay when you sell — and buyers see exactly what they owe before they confirm.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl space-y-6 px-6 py-12 md:px-10">

        {/* ── For sellers ── */}
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">For sellers</p>
          <div className="space-y-4">

            {/* Paid events */}
            <Card className="p-6 md:p-8">
              <SectionHeader
                icon="🎟️"
                title="Paid events"
                sub="Public Events and Invite-Only Events with a ticket price"
              />
              <FeeRow
                label="Platform fee"
                value={`${paidFeePercent}% per ticket sold`}
                sub="Deducted from each ticket sale before payout. Applies to Public and Invite-Only events."
                variant="fee"
              />
              <FeeRow
                label="Setup fee"
                value="Free"
                sub="No charge to create or publish a paid event."
                variant="free"
              />
              <FeeRow
                label="Payout"
                value="On demand"
                sub="Request a disbursement any time from your seller dashboard. Proceeds (ticket revenue minus platform fee) are sent to your registered payout account."
                variant="info"
              />
              <Note>
                Custom platform fee rates may be negotiated for high-volume sellers. Contact{" "}
                <a href="mailto:support@lumora.co.ke" className="text-primary-600 hover:underline">support@lumora.co.ke</a>.
              </Note>
            </Card>

            {/* Free events */}
            {feeTiers.length > 0 && (
              <Card className="p-6 md:p-8">
                <SectionHeader
                  icon="🆓"
                  title="Free events"
                  sub="Events where tickets are issued at no charge to attendees"
                />
                <p className="mb-3 text-sm text-gray-500 leading-relaxed">
                  Free events are activated with a one-time flat fee based on your expected attendance capacity. There is no per-ticket charge.
                </p>
                <div className="overflow-hidden rounded-xl border border-gray-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Capacity</th>
                        <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-gray-500">Activation fee</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feeTiers.map((tier, i) => (
                        <tr key={tier.id} className={`border-b border-gray-50 last:border-0 ${i % 2 === 0 ? "" : "bg-gray-50/50"}`}>
                          <td className="px-4 py-3 font-medium text-gray-800">
                            {tier.label}
                            {tier.maxCap !== null && (
                              <span className="ml-2 text-xs text-gray-400">
                                (up to {tier.maxCap.toLocaleString()} attendees)
                              </span>
                            )}
                            {tier.maxCap === null && (
                              <span className="ml-2 text-xs text-gray-400">(unlimited)</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-black text-gray-900">
                            KES {tier.price.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Note>
                  You can upgrade your tier at any time before the event. You only pay the difference between your current tier and the new one.
                </Note>
              </Card>
            )}

            {/* Group trips */}
            <Card className="p-6 md:p-8">
              <SectionHeader
                icon="🧳"
                title="Group Trips"
                sub="Private cost-sharing experiences among friends, family, or a social group"
              />
              <FeeRow
                label="Listing fee"
                value={`KES ${groupTripFlatFee.toLocaleString()} × declared participants`}
                sub="One-time upfront fee based on your declared group size — paid before publishing. No per-participant deduction on bookings."
                variant="fee"
              />
              <FeeRow
                label="Per-booking cut"
                value="None"
                sub="Once the listing fee is paid, all participant payments flow entirely to you."
                variant="free"
              />
              <Note>
                Group Trips are reserved for genuine personal social travel — not commercial tour operators or travel businesses. See our{" "}
                <Link href="/terms#10" className="text-primary-600 hover:underline">Group Trip policy</Link> for full eligibility rules.
              </Note>
            </Card>

          </div>
        </div>

        {/* ── For buyers ── */}
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">For buyers</p>
          <Card className="p-6 md:p-8">
            <SectionHeader
              icon="🛒"
              title="Buyer fees"
              sub="Charged at checkout — always shown before you confirm payment"
            />

            <FeeRow
              label="Processing fee"
              value={`KES ${convenienceFee.toLocaleString()} per transaction`}
              sub="Applied once per checkout on all paid tickets. Not charged on free tickets."
              variant="fee"
            />
            <FeeRow
              label="Installment plan fee"
              value={`${installmentFeePercent}% of ticket price (max KES ${installmentFeeCap.toLocaleString()})`}
              sub="Charged once on the initial deposit when paying by installments. No fee on subsequent installment payments."
              variant="fee"
            />
            <FeeRow
              label="Ticket transfer fee"
              value={`KES ${transferFee.toLocaleString()} per transfer`}
              sub="Payable by the recipient on acceptance. The sender may choose to cover this fee upfront."
              variant="fee"
            />
            <FeeRow
              label="Free tickets"
              value="No fee"
              sub="Free events do not attract a processing fee."
              variant="free"
            />
            <Note>
              All fees are shown in full at the checkout screen before any payment is taken. Fees are non-refundable except where a Seller cancels a published event, in which case the full amount paid — including fees — is refunded. See our{" "}
              <Link href="/terms#04" className="text-primary-600 hover:underline">Terms of Service</Link> for details.
            </Note>
          </Card>
        </div>

        {/* ── FAQ strip ── */}
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">Common questions</p>
          <div className="space-y-3">
            {[
              {
                q: "When do sellers get paid?",
                a: "You can request a disbursement at any time from your seller dashboard — there's no waiting for the event to end. Proceeds are sent to your registered bank or mobile money account and you can track the status from your dashboard.",
              },
              {
                q: "Can the platform fee be different for my event?",
                a: "Yes — custom rates are available for high-volume sellers. Reach out to us before publishing your event and we can agree a rate in writing.",
              },
              {
                q: "Are the processing and installment fees refundable?",
                a: "No — these are non-refundable Platform charges. The exception is a Seller-initiated cancellation of a published event, where buyers receive a full refund of all amounts paid.",
              },
              {
                q: "Who pays the transfer fee — sender or recipient?",
                a: "By default the recipient pays the KES 50 fee when they accept. But when initiating a transfer, the sender can choose to cover it — in which case the recipient pays nothing on acceptance.",
              },
              {
                q: "What if I buy an installment ticket and miss a payment?",
                a: "You'll receive reminder emails. If the payment isn't made within the Seller's grace period, your ticket may be revoked. All amounts paid up to that point are non-refundable. See the full revocation policy in our Terms of Service.",
              },
            ].map(({ q, a }) => (
              <Card key={q} className="p-5">
                <p className="text-sm font-bold text-gray-900">{q}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{a}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* ── CTA ── */}
        <div className="rounded-2xl bg-primary-600 px-8 py-10 text-center">
          <h3 className="text-xl font-black text-white">Ready to list your experience?</h3>
          <p className="mt-2 text-sm text-primary-200">Create your event in minutes — no subscription, no upfront cost.</p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/register?role=seller"
              className="rounded-xl bg-white px-6 py-2.5 text-sm font-bold text-primary-700 hover:bg-primary-50 transition-colors"
            >
              Start selling
            </Link>
            <Link
              href="/terms"
              className="rounded-xl border border-primary-400 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
            >
              Read the terms
            </Link>
          </div>
        </div>

      </div>

      <Footer />
    </div>
  );
}
