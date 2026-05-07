"use client";

import { useState } from "react";
import { adminCancelOrder } from "@/app/actions/admin";

export function CancelOrderButton({ orderId, status }: { orderId: string; status: string }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (status === "CANCELLED" || done) {
    return <span className="text-xs text-gray-400">Cancelled</span>;
  }
  if (status === "PAID_IN_FULL") {
    return <span className="text-xs text-gray-300">—</span>;
  }

  async function handleCancel() {
    if (!confirm("Cancel this order? This cannot be undone.")) return;
    setLoading(true);
    setError("");
    const res = await adminCancelOrder(orderId);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDone(true);
  }

  return (
    <div>
      <button
        onClick={handleCancel}
        disabled={loading}
        className="text-sm font-semibold text-red-600 hover:underline disabled:opacity-50"
      >
        {loading ? "Cancelling…" : "Cancel"}
      </button>
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}
