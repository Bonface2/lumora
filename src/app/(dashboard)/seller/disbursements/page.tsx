import { redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/lib/auth";
import { getDisbursementData } from "@/app/actions/payout";
import { RequestDisbursementButton } from "./RequestDisbursementButton";

export const dynamic = "force-dynamic";

function AccountDisplay({ bankType, accountNumber }: { bankType: string; accountNumber: string }) {
  const isMobile = bankType === "mobile_money" || bankType === "mobile_money_business";
  return <>{isMobile ? accountNumber : `···· ${accountNumber.slice(-4)}`}</>;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "success") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Paid
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      Pending
    </span>
  );
}

export default async function DisbursementsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const result = await getDisbursementData();
  if (!result.ok) redirect("/seller");

  const { grossRevenue, platformFee, earned, paidOut, outstanding, history, payoutMethods } = result.data;
  const primaryMethod = payoutMethods[0] ?? null;

  const kpis = [
    {
      label: "Total earned",
      value: `KES ${earned.toLocaleString()}`,
      sub: "after platform fees",
      color: "text-emerald-600",
      border: "border-emerald-100",
    },
    {
      label: "Gross revenue",
      value: `KES ${grossRevenue.toLocaleString()}`,
      sub: `KES ${platformFee.toLocaleString()} in fees`,
      color: "text-gray-900",
      border: "border-gray-100",
    },
    {
      label: "Paid out",
      value: `KES ${paidOut.toLocaleString()}`,
      sub: `${history.filter((h) => h.status === "success").length} disbursement${history.filter((h) => h.status === "success").length !== 1 ? "s" : ""}`,
      color: "text-primary-600",
      border: "border-gray-100",
    },
    {
      label: "Outstanding",
      value: `KES ${outstanding.toLocaleString()}`,
      sub: outstanding > 0 ? "ready to disburse" : "all caught up",
      color: outstanding > 0 ? "text-amber-600" : "text-gray-400",
      border: outstanding > 0 ? "border-amber-200" : "border-gray-100",
    },
  ];

  return (
    <div className="min-h-full bg-gray-50 font-sans">
      {/* ── Header ── */}
      <div className="relative overflow-hidden bg-gray-800">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle, #16b5b8 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="pointer-events-none absolute -top-24 right-1/4 h-64 w-96 rounded-full bg-primary-500/20 blur-[80px]" />
        <div className="relative px-8 pt-6 pb-8">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-black tracking-tight text-white">Disbursements</h1>
            <p className="text-sm text-gray-400">Track your earnings and request payouts to your account.</p>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-8">
        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className={`rounded-2xl border ${k.border} bg-white p-5 shadow-sm`}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{k.label}</p>
              <p className={`mt-2 text-2xl font-black leading-none ${k.color}`}>{k.value}</p>
              <p className="mt-1.5 text-xs text-gray-400">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Request disbursement card ── */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-base font-black text-gray-900">Request a disbursement</h2>
          <p className="mb-5 text-sm text-gray-500">
            Submit a request and we&apos;ll process your outstanding balance to your payout account within 2–5 business days.
          </p>

          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            {/* Balance summary */}
            <div className="space-y-3">
              <div className={`inline-flex flex-col rounded-xl px-5 py-4 ${outstanding > 0 ? "bg-amber-50 border border-amber-200" : "bg-gray-50 border border-gray-200"}`}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Outstanding balance</p>
                <p className={`mt-1 text-3xl font-black ${outstanding > 0 ? "text-amber-600" : "text-gray-400"}`}>
                  KES {outstanding.toLocaleString()}
                </p>
              </div>

              {primaryMethod && (
                <div className="flex items-center gap-2.5 text-sm text-gray-600">
                  <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  <span>
                    <span className="font-semibold">{primaryMethod.paystackBankName}</span>
                    {" · "}
                    <AccountDisplay bankType={primaryMethod.bankType} accountNumber={primaryMethod.paystackAccountNumber} />
                    {primaryMethod.label && <span className="ml-1.5 text-gray-400">({primaryMethod.label})</span>}
                  </span>
                </div>
              )}
            </div>

            {/* Action */}
            <div className="sm:pt-1">
              <RequestDisbursementButton outstanding={outstanding} hasMethod={payoutMethods.length > 0} />
            </div>
          </div>
        </div>

        {/* ── Payout history ── */}
        <div>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">Payout history</h2>
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            {history.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-500">No disbursements yet</p>
                <p className="mt-1 text-xs text-gray-400">Disbursements will appear here once processed.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left">
                    <th className="px-5 py-3 font-semibold text-gray-600">Date</th>
                    <th className="px-5 py-3 font-semibold text-gray-600">Amount</th>
                    <th className="px-5 py-3 font-semibold text-gray-600">Account</th>
                    <th className="px-5 py-3 font-semibold text-gray-600">Status</th>
                    <th className="px-5 py-3 font-semibold text-gray-600">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {history.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4 text-gray-600">
                        {format(new Date(p.createdAt), "dd MMM yyyy")}
                      </td>
                      <td className="px-5 py-4 font-semibold text-gray-900">
                        KES {p.amount.toLocaleString()}
                      </td>
                      <td className="px-5 py-4 text-gray-600">
                        {p.payoutMethod ? (
                          <>
                            <span className="font-medium">{p.payoutMethod.paystackBankName}</span>
                            {" · "}
                            <AccountDisplay
                              bankType={p.payoutMethod.bankType}
                              accountNumber={p.payoutMethod.paystackAccountNumber}
                            />
                          </>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-gray-400">{p.reference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
