"use client";

import { useState } from "react";
import { extendGracePeriod } from "@/app/actions/events";

interface Props {
  orderId: string;
  buyerName: string;
}

const EXTENSION_OPTIONS = [3, 7, 14] as const;

export function ExtendGracePeriodButton({ orderId, buyerName }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (done) {
    return <span className="text-xs font-semibold text-emerald-600">Extended</span>;
  }

  if (open) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <p className="text-xs text-gray-500">Extend grace for {buyerName}:</p>
        <div className="flex items-center gap-1.5">
          {EXTENSION_OPTIONS.map((days) => (
            <button
              key={days}
              disabled={loading !== null}
              onClick={async () => {
                setLoading(days);
                setError("");
                const res = await extendGracePeriod(orderId, days);
                setLoading(null);
                if (!res.ok) {
                  setError(res.error);
                } else {
                  setDone(true);
                }
              }}
              className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
            >
              {loading === days ? "…" : `+${days}d`}
            </button>
          ))}
          <button
            onClick={() => { setOpen(false); setError(""); }}
            className="text-xs text-gray-400 hover:text-gray-600 px-1"
          >
            Cancel
          </button>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <button
      onClick={() => setOpen(true)}
      className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      Extend
    </button>
  );
}
