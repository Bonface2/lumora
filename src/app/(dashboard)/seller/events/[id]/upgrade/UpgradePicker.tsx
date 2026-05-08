"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { initiateEventTierUpgrade } from "@/app/actions/events";

interface Tier {
  id: string;
  label: string;
  maxCap: number | null;
  price: number;
  upgradeCost: number; // price - alreadyPaid
}

interface Props {
  eventId: string;
  currentLabel: string;
  currentCap: number | null;
  upgradeTiers: Tier[];
}

export function UpgradePicker({ eventId, currentLabel, currentCap, upgradeTiers }: Props) {
  const [selectedId, setSelectedId] = useState(upgradeTiers[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selected = upgradeTiers.find((t) => t.id === selectedId);

  async function handlePay() {
    if (!selectedId) return;
    setLoading(true);
    setError("");
    const res = await initiateEventTierUpgrade(eventId, selectedId);
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    window.location.href = res.data.authorizationUrl;
  }

  if (upgradeTiers.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-6 text-center">
        <p className="text-sm font-semibold text-gray-600">You are already on the highest tier.</p>
        <p className="mt-1 text-xs text-gray-400">
          For events over 100 attendees needing staff support, please contact us directly.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Current tier */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Current tier</p>
        <p className="mt-0.5 font-semibold text-gray-900">
          {currentLabel} — {currentCap !== null ? `up to ${currentCap} attendees` : "unlimited"}
        </p>
      </div>

      {/* Upgrade options */}
      <p className="text-sm font-semibold text-gray-700">Upgrade to:</p>
      <div className="grid grid-cols-2 gap-3">
        {upgradeTiers.map((tier) => {
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
              <span className="mt-1 text-base font-black text-gray-900">
                {tier.maxCap !== null ? `Up to ${tier.maxCap}` : "100+"}
                <span className="text-sm font-normal text-gray-400"> attendees</span>
              </span>
              <span className={`mt-2 text-lg font-black ${isSelected ? "text-primary-700" : "text-gray-900"}`}>
                +KES {tier.upgradeCost.toLocaleString()}
              </span>
              <span className="text-xs text-gray-400">
                (KES {tier.price.toLocaleString()} total)
              </span>
            </button>
          );
        })}
      </div>

      {selected?.maxCap === null && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Staff support for large events is arranged separately. We will contact you after payment.
        </p>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <Button onClick={handlePay} loading={loading} disabled={!selectedId} className="w-full">
        Pay +KES {selected?.upgradeCost.toLocaleString() ?? "—"} &amp; upgrade
      </Button>
    </div>
  );
}
