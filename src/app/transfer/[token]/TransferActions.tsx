"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { respondToTransfer } from "@/app/actions/transfer";

export function TransferActions({ token, totalDueNow }: { token: string; totalDueNow: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState("");

  async function handle(action: "accept" | "decline") {
    setLoading(action);
    setError("");
    const res = await respondToTransfer(token, action);
    if (!res.ok) {
      setError(res.error);
      setLoading(null);
      return;
    }
    if (action === "accept") {
      if (res.data?.paymentUrl) {
        window.location.href = res.data.paymentUrl;
      } else {
        router.push("/buyer?transferred=1");
      }
    } else {
      router.push("/?declined=1");
    }
  }

  const acceptLabel = `Accept & Pay KES ${totalDueNow.toLocaleString()}`;

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}
      <button
        onClick={() => handle("accept")}
        disabled={!!loading}
        className="w-full rounded-xl bg-primary-600 px-4 py-3 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-60 transition-colors"
      >
        {loading === "accept" ? "Redirecting to payment…" : acceptLabel}
      </button>
      <button
        onClick={() => handle("decline")}
        disabled={!!loading}
        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
      >
        {loading === "decline" ? "Declining…" : "Decline"}
      </button>
    </div>
  );
}
