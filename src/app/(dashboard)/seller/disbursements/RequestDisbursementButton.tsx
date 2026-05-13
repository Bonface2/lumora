"use client";

import { useState } from "react";
import { requestDisbursement } from "@/app/actions/payout";

export function RequestDisbursementButton({
  outstanding,
  hasMethod,
}: {
  outstanding: number;
  hasMethod: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handle() {
    setLoading(true);
    setError("");
    const res = await requestDisbursement();
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <svg className="h-4 w-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <p className="text-sm font-semibold text-emerald-700">
          Request sent! We&apos;ll review and process your disbursement shortly.
        </p>
      </div>
    );
  }

  const canRequest = outstanding >= 1 && hasMethod;

  return (
    <div className="space-y-3">
      <button
        onClick={handle}
        disabled={loading || !canRequest}
        className="flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
      >
        {loading ? (
          <>
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Sending request…
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            Request disbursement
          </>
        )}
      </button>

      {!hasMethod && (
        <p className="text-xs text-amber-700">
          <a href="/seller/settings" className="font-semibold underline">Add a payout method</a> in Settings before requesting a disbursement.
        </p>
      )}
      {hasMethod && outstanding < 1 && (
        <p className="text-xs text-gray-400">No outstanding balance to disburse.</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
