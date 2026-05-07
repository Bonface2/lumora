"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { getSellerBalances, triggerSellerPayout } from "@/app/actions/admin";

type Balance = Awaited<ReturnType<typeof getSellerBalances>>[number];

const MOBILE_TYPES = new Set(["mobile_money", "mobile_money_business"]);

function accountDisplay(m: Balance["payoutMethod"]) {
  if (!m) return null;
  if (MOBILE_TYPES.has(m.bankType)) return m.accountNumber;
  return `****${m.accountNumber.slice(-4)}`;
}

function fmt(n: number) {
  return `KES ${n.toLocaleString()}`;
}

export default function AdminPayoutsPage() {
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [, startTransition] = useTransition();

  useEffect(() => {
    getSellerBalances().then((b) => {
      setBalances(b);
      setLoading(false);
    });
  }, []);

  async function handlePayout(b: Balance) {
    if (!b.payoutMethod) return;
    setPaying(b.key);
    const res = await triggerSellerPayout(b.seller.id, b.payoutMethod.id, b.outstanding);
    setResults((prev) => ({
      ...prev,
      [b.key]: res.ok
        ? { ok: true, msg: "Transfer initiated — pending Paystack confirmation." }
        : { ok: false, msg: res.error },
    }));
    if (res.ok) {
      startTransition(() => setBalances((prev) => prev.filter((x) => x.key !== b.key)));
    }
    setPaying(null);
  }

  return (
    <div className="min-h-full bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-3xl">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-black text-gray-900">Payouts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Outstanding seller balances from fully-paid orders, grouped by payout account.
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm text-gray-400">Loading balances…</p>
          </div>
        )}

        {!loading && balances.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
              <svg className="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-semibold text-gray-700">All clear</p>
            <p className="mt-1 text-sm text-gray-400">No outstanding balances — all seller earnings have been paid out.</p>
          </div>
        )}

        <div className="space-y-5">
          {balances.map((b) => {
            const result = results[b.key];
            const initials = b.seller.name
              ? b.seller.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
              : b.seller.email[0].toUpperCase();

            return (
              <div key={b.key} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">

                {/* Card header */}
                <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-black text-primary-700">
                      {initials}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{b.seller.name ?? "—"}</p>
                      <p className="text-xs text-gray-400">{b.seller.email}</p>
                    </div>
                  </div>

                  {/* Payout account */}
                  <div className="text-right">
                    {b.payoutMethod ? (
                      <>
                        <p className="text-sm font-semibold text-gray-700">{b.payoutMethod.bankName}</p>
                        <p className="text-xs text-gray-400">
                          {accountDisplay(b.payoutMethod)}
                          {b.payoutMethod.label && (
                            <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">
                              {b.payoutMethod.label}
                            </span>
                          )}
                        </p>
                      </>
                    ) : (
                      <span className="text-xs font-semibold text-amber-600">No payout account</span>
                    )}
                  </div>
                </div>

                {/* Financials row */}
                <div className="grid grid-cols-4 divide-x divide-gray-100 border-b border-gray-100">
                  {[
                    { label: "Gross revenue", value: fmt(b.grossRevenue), color: "text-gray-800" },
                    { label: "Platform fee", value: fmt(b.platformFee), color: "text-primary-600" },
                    { label: "Seller net", value: fmt(b.earned), color: "text-gray-800" },
                    { label: "Outstanding", value: fmt(b.outstanding), color: "text-gray-900 font-black" },
                  ].map((s) => (
                    <div key={s.label} className="px-5 py-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{s.label}</p>
                      <p className={`mt-1 text-base font-bold ${s.color}`}>{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Event breakdown */}
                {b.events.length > 0 && (
                  <div className="px-6 py-4">
                    <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">Events</p>
                    <div className="overflow-hidden rounded-xl border border-gray-100">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50 text-left">
                            <th className="px-4 py-2.5 text-xs font-semibold text-gray-500">Event</th>
                            <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 text-center">Fee</th>
                            <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 text-right">Gross</th>
                            <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 text-right">Seller net</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {b.events.map((ev) => (
                            <tr key={ev.eventId} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-2.5">
                                <p className="font-semibold text-gray-800 line-clamp-1">{ev.title}</p>
                                <p className="text-[11px] text-gray-400">
                                  {new Date(ev.date).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                                </p>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <span className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-xs font-bold text-primary-700">
                                  {ev.feePercent}%
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right text-gray-600">
                                KES {ev.grossAmount.toLocaleString()}
                              </td>
                              <td className="px-4 py-2.5 text-right font-semibold text-gray-800">
                                KES {ev.sellerNet.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Action row */}
                <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
                  {b.paidOut > 0 && (
                    <p className="text-xs text-gray-400">
                      {fmt(b.paidOut)} already paid out
                    </p>
                  )}
                  <div className="ml-auto">
                    {result ? (
                      <p className={`text-sm font-semibold ${result.ok ? "text-emerald-600" : "text-red-600"}`}>
                        {result.msg}
                      </p>
                    ) : (
                      <Button
                        disabled={!b.payoutMethod || paying === b.key}
                        loading={paying === b.key}
                        onClick={() => handlePayout(b)}
                      >
                        Pay out {fmt(b.outstanding)}
                      </Button>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>

        {!loading && balances.length > 0 && (
          <p className="mt-6 text-center text-xs text-gray-400">
            Transfers are processed by Paystack — minutes for mobile money, 1–2 business days for bank accounts.
          </p>
        )}

      </div>
    </div>
  );
}
