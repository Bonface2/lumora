"use client";

import { useState } from "react";
import { sellerRevokeOrder } from "@/app/actions/events";

interface Props {
  orderId: string;
  buyerName: string;
}

export function RevokeButton({ orderId, buyerName }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (done) {
    return <span className="text-xs font-semibold text-red-600">Revoked</span>;
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-600">Revoke {buyerName}?</span>
        <button
          onClick={async () => {
            setLoading(true);
            const res = await sellerRevokeOrder(orderId);
            setLoading(false);
            if (!res.ok) {
              setError(res.error);
              setConfirming(false);
            } else {
              setDone(true);
            }
          }}
          disabled={loading}
          className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? "…" : "Yes, revoke"}
        </button>
        <button
          onClick={() => { setConfirming(false); setError(""); }}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Cancel
        </button>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors"
    >
      Revoke
    </button>
  );
}
