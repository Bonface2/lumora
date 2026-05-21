"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { initiateGroupTripActivationFee } from "@/app/actions/events";

interface Props {
  eventId: string;
  capacity: number;
  flatFee: number;
}

export function GroupTripActivation({ eventId, capacity, flatFee }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const total = capacity * flatFee;

  async function handlePay() {
    setLoading(true);
    setError("");
    const res = await initiateGroupTripActivationFee(eventId);
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    window.location.href = res.data.authorizationUrl;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Fee breakdown</p>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">
            {capacity} participant{capacity !== 1 ? "s" : ""} × KES {flatFee.toLocaleString()}
          </span>
          <span className="font-black text-gray-900">KES {total.toLocaleString()}</span>
        </div>
        <div className="border-t border-gray-200 pt-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">Total due</span>
          <span className="text-xl font-black text-primary-700">KES {total.toLocaleString()}</span>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <Button onClick={handlePay} loading={loading} className="w-full">
        Pay KES {total.toLocaleString()} &amp; unlock publishing
      </Button>
    </div>
  );
}
