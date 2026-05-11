"use client";

import { useState } from "react";

interface Props {
  orderId: string;
  buyerName: string;
  action: (orderId: string) => Promise<{ ok: boolean; error?: string }>;
  onDone?: () => void;
}

export function ReinstateButton({ orderId, buyerName, action, onDone }: Props) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (done) {
    return <span className="text-xs font-semibold text-emerald-600">Reinstated</span>;
  }

  async function handleReinstate() {
    if (!confirm(`Reinstate ticket for ${buyerName}? Their ticket will become valid again.`)) return;
    setLoading(true);
    setError("");
    const res = await action(orderId);
    setLoading(false);
    if (!res.ok) {
      setError(res.error ?? "Failed.");
      return;
    }
    setDone(true);
    onDone?.();
  }

  return (
    <div>
      <button
        onClick={handleReinstate}
        disabled={loading}
        className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
      >
        {loading ? "Reinstating…" : "Reinstate"}
      </button>
      {error && <p className="mt-0.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}
