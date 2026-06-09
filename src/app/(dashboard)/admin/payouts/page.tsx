"use client";

import { useEffect, useState, useTransition } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/Button";
import {
  getSellerBalances,
  triggerSellerPayout,
  getAdminDisbursements,
  getAdminDisbursementSellers,
} from "@/app/actions/admin";

type Balance = Awaited<ReturnType<typeof getSellerBalances>>[number];
type Disbursement = Awaited<ReturnType<typeof getAdminDisbursements>>[number];
type Seller = Awaited<ReturnType<typeof getAdminDisbursementSellers>>[number];

const MOBILE_TYPES = new Set(["mobile_money", "mobile_money_business"]);

function accountDisplay(m: { bankType: string; accountNumber: string; label: string | null } | null) {
  if (!m) return "—";
  const num = MOBILE_TYPES.has(m.bankType) ? m.accountNumber : `****${m.accountNumber.slice(-4)}`;
  return m.label ? `${m.label} · ${num}` : num;
}

function fmt(n: number) {
  return `KES ${n.toLocaleString()}`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "success") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Success
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
      Failed
    </span>
  );
}

export default function AdminPayoutsPage() {
  const [tab, setTab] = useState<"outstanding" | "history">("outstanding");

  // ── Outstanding tab ──────────────────────────────────────────────────────
  const [balances, setBalances] = useState<Balance[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [, startTransition] = useTransition();

  useEffect(() => {
    getSellerBalances().then((b) => {
      setBalances(b);
      setBalancesLoading(false);
    });
  }, []);

  async function handlePayout(b: Balance) {
    if (!b.payoutMethod) return;
    setPaying(b.key);
    const res = await triggerSellerPayout(b.seller.id, b.payoutMethod.id, b.outstanding);
    setResults((prev) => ({
      ...prev,
      [b.key]: res.ok
        ? { ok: true, msg: "Transfer initiated — pending IntaSend confirmation." }
        : { ok: false, msg: res.error },
    }));
    if (res.ok) {
      startTransition(() => setBalances((prev) => prev.filter((x) => x.key !== b.key)));
      // Refresh history list
      fetchHistory(selectedSeller);
    }
    setPaying(null);
  }

  // ── History tab ──────────────────────────────────────────────────────────
  const [disbursements, setDisbursements] = useState<Disbursement[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [selectedSeller, setSelectedSeller] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);

  function fetchHistory(sellerId: string) {
    setHistoryLoading(true);
    getAdminDisbursements(sellerId || undefined).then((d) => {
      setDisbursements(d);
      setHistoryLoading(false);
    });
  }

  useEffect(() => {
    if (tab === "history") {
      getAdminDisbursementSellers().then(setSellers);
      fetchHistory(selectedSeller);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function handleSellerChange(id: string) {
    setSelectedSeller(id);
    fetchHistory(id);
  }

  // Totals for current filter
  const successTotal = disbursements
    .filter((d) => d.status === "success")
    .reduce((s, d) => s + Number(d.amount), 0);

  return (
    <div className="min-h-full bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-4xl">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-black text-gray-900">Payouts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage outstanding seller balances and view disbursement history.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl border border-gray-200 bg-white p-1 w-fit shadow-sm">
          {(["outstanding", "history"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-lg px-5 py-2 text-sm font-semibold transition-colors capitalize ${
                tab === t
                  ? "bg-primary-600 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {t === "outstanding" ? "Outstanding" : "Disbursement history"}
            </button>
          ))}
        </div>

        {/* ── Outstanding ── */}
        {tab === "outstanding" && (
          <>
            {balancesLoading && (
              <div className="flex items-center justify-center py-20">
                <p className="text-sm text-gray-400">Loading balances…</p>
              </div>
            )}

            {!balancesLoading && balances.length === 0 && (
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
                      <div className="text-right">
                        {b.payoutMethod ? (
                          <>
                            <p className="text-sm font-semibold text-gray-700">{b.payoutMethod.bankName}</p>
                            <p className="text-xs text-gray-400">
                              {accountDisplay(b.payoutMethod)}
                            </p>
                          </>
                        ) : (
                          <span className="text-xs font-semibold text-amber-600">No payout account</span>
                        )}
                      </div>
                    </div>

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
                                      {ev.feeLabel}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5 text-right text-gray-600">KES {ev.grossAmount.toLocaleString()}</td>
                                  <td className="px-4 py-2.5 text-right font-semibold text-gray-800">KES {ev.sellerNet.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
                      {b.paidOut > 0 && (
                        <p className="text-xs text-gray-400">{fmt(b.paidOut)} already paid out</p>
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

            {!balancesLoading && balances.length > 0 && (
              <p className="mt-6 text-center text-xs text-gray-400">
                Transfers are processed by IntaSend — minutes for mobile money, 1–2 business days for bank accounts.
              </p>
            )}
          </>
        )}

        {/* ── History ── */}
        {tab === "history" && (
          <div className="space-y-5">
            {/* Filter + summary row */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600">Recipient</label>
                <select
                  value={selectedSeller}
                  onChange={(e) => handleSellerChange(e.target.value)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">All sellers</option>
                  {sellers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name ?? s.email}
                    </option>
                  ))}
                </select>
              </div>

              {!historyLoading && disbursements.length > 0 && (
                <p className="text-sm text-gray-500">
                  <span className="font-bold text-gray-900">{disbursements.length}</span> payout{disbursements.length !== 1 ? "s" : ""} ·{" "}
                  <span className="font-bold text-emerald-600">{fmt(successTotal)}</span> disbursed
                </p>
              )}
            </div>

            {historyLoading && (
              <div className="flex items-center justify-center py-20">
                <p className="text-sm text-gray-400">Loading…</p>
              </div>
            )}

            {!historyLoading && disbursements.length === 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
                <p className="font-semibold text-gray-600">No disbursements found</p>
                <p className="mt-1 text-sm text-gray-400">
                  {selectedSeller ? "No payouts for this seller yet." : "No payouts have been made yet."}
                </p>
              </div>
            )}

            {!historyLoading && disbursements.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-left">
                      <th className="px-5 py-3.5 text-xs font-semibold text-gray-500">Recipient</th>
                      <th className="px-5 py-3.5 text-xs font-semibold text-gray-500">Account</th>
                      <th className="px-5 py-3.5 text-xs font-semibold text-gray-500 text-right">Amount</th>
                      <th className="px-5 py-3.5 text-xs font-semibold text-gray-500">Status</th>
                      <th className="px-5 py-3.5 text-xs font-semibold text-gray-500">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {disbursements.map((d) => {
                      const initials = d.seller.name
                        ? d.seller.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
                        : d.seller.email[0].toUpperCase();

                      return (
                        <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-black text-primary-700">
                                {initials}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-800">{d.seller.name ?? "—"}</p>
                                <p className="text-xs text-gray-400">{d.seller.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            {d.payoutMethod ? (
                              <div>
                                <p className="font-medium text-gray-700">{d.payoutMethod.bankName}</p>
                                <p className="text-xs text-gray-400">{accountDisplay(d.payoutMethod)}</p>
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right font-bold text-gray-900 whitespace-nowrap">
                            {fmt(Number(d.amount))}
                          </td>
                          <td className="px-5 py-3.5">
                            <StatusBadge status={d.status} />
                          </td>
                          <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">
                            {format(d.createdAt, "dd MMM yyyy · HH:mm")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
