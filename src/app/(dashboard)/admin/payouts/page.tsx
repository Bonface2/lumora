"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { getSellerBalances, triggerSellerPayout } from "@/app/actions/admin";

type Balance = Awaited<ReturnType<typeof getSellerBalances>>[number];

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

  async function handlePayout(sellerId: string, amount: number) {
    setPaying(sellerId);
    const res = await triggerSellerPayout(sellerId, amount);
    setResults((prev) => ({
      ...prev,
      [sellerId]: res.ok
        ? { ok: true, msg: "Transfer initiated — pending Paystack confirmation." }
        : { ok: false, msg: res.error },
    }));
    if (res.ok) {
      startTransition(() => {
        setBalances((prev) => prev.filter((b) => b.seller.id !== sellerId));
      });
    }
    setPaying(null);
  }

  const mobileCodes = new Set(["MPESA", "ATL_KE", "97"]);

  return (
    <div className="min-h-full bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-gray-900">Payouts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Outstanding seller balances from fully-paid ticket orders. Lumora&apos;s platform fee
            has already been deducted.
          </p>
        </div>

        {loading && (
          <p className="text-sm text-gray-400">Loading balances…</p>
        )}

        {!loading && balances.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
            <p className="text-sm font-semibold text-gray-500">No outstanding balances.</p>
            <p className="mt-1 text-xs text-gray-400">All seller earnings have been paid out.</p>
          </div>
        )}

        {balances.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-5 py-3 font-semibold text-gray-600">Seller</th>
                  <th className="px-5 py-3 font-semibold text-gray-600">Payout account</th>
                  <th className="px-5 py-3 font-semibold text-gray-600 text-right">Total earned</th>
                  <th className="px-5 py-3 font-semibold text-gray-600 text-right">Paid out</th>
                  <th className="px-5 py-3 font-semibold text-gray-600 text-right">Outstanding</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {balances.map((b) => {
                  const isMobile = b.seller.bankCode ? mobileCodes.has(b.seller.bankCode) : false;
                  const accountDisplay = isMobile
                    ? b.seller.accountNumber
                    : `****${b.seller.accountNumber?.slice(-4)}`;
                  const result = results[b.seller.id];

                  return (
                    <tr key={b.seller.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900">{b.seller.name ?? "—"}</p>
                        <p className="text-xs text-gray-400">{b.seller.email}</p>
                      </td>
                      <td className="px-5 py-4 text-gray-600">
                        {b.seller.recipientCode ? (
                          <>
                            <p className="font-medium">{b.seller.bankName}</p>
                            <p className="text-xs text-gray-400">{accountDisplay}</p>
                          </>
                        ) : (
                          <span className="text-xs text-amber-600 font-semibold">No payout account</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right text-gray-600">
                        KES {b.earned.toLocaleString()}
                      </td>
                      <td className="px-5 py-4 text-right text-gray-400">
                        KES {b.paidOut.toLocaleString()}
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-gray-900">
                        KES {b.outstanding.toLocaleString()}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {result ? (
                          <span className={`text-xs font-semibold ${result.ok ? "text-emerald-600" : "text-red-600"}`}>
                            {result.msg}
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            disabled={!b.seller.recipientCode || paying === b.seller.id}
                            loading={paying === b.seller.id}
                            onClick={() => handlePayout(b.seller.id, b.outstanding)}
                          >
                            Pay out
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-xs text-gray-400 text-center">
          Transfers are processed by Paystack and typically arrive within minutes for mobile money,
          or 1–2 business days for bank accounts.
        </p>
      </div>
    </div>
  );
}
