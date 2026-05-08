"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { initiateEventActivationFee } from "@/app/actions/events";

interface Tier {
  id: string;
  label: string;
  maxCap: number | null;
  price: number;
}

interface Props {
  eventId: string;
  tiers: Tier[];
}

export function TierPicker({ eventId, tiers }: Props) {
  const [selectedId, setSelectedId] = useState(tiers[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selected = tiers.find((t) => t.id === selectedId);

  async function handlePay() {
    if (!selectedId) return;
    setLoading(true);
    setError("");
    const res = await initiateEventActivationFee(eventId, selectedId);
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    window.location.href = res.data.authorizationUrl;
  }

  return (
    <div className="space-y-4">
      {/* Tier cards */}
      <div className="grid grid-cols-2 gap-3">
        {tiers.map((tier) => {
          const isSelected = selectedId === tier.id;
          return (
            <button
              key={tier.id}
              type="button"
              onClick={() => setSelectedId(tier.id)}
              className={`flex flex-col rounded-xl border-2 p-4 text-left transition-all ${
                isSelected
                  ? "border-primary-500 bg-primary-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">{tier.label}</span>
              <span className="mt-1 text-lg font-black text-gray-900">
                {tier.maxCap !== null ? `Up to ${tier.maxCap}` : "100+"}
                <span className="text-sm font-normal text-gray-400"> attendees</span>
              </span>
              <span className={`mt-2 text-xl font-black ${isSelected ? "text-primary-700" : "text-gray-900"}`}>
                KES {tier.price.toLocaleString()}
              </span>
              {tier.maxCap === null && (
                <span className="mt-1 text-[11px] text-amber-600 font-semibold">
                  Staff support: quoted separately
                </span>
              )}
              {isSelected && (
                <span className="mt-2 flex items-center gap-1 text-xs font-bold text-primary-600">
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Selected
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Note for large tier */}
      {selected?.maxCap === null && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          For events over 100 attendees, Lumora staff support can be arranged. We will reach out after payment to discuss logistics.
        </p>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <Button onClick={handlePay} loading={loading} disabled={!selectedId} className="w-full">
        Pay KES {selected?.price.toLocaleString() ?? "—"} &amp; activate
      </Button>
    </div>
  );
}
