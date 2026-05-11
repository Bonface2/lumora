"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { updatePlatformConfig } from "@/app/actions/admin";

interface Props {
  paidFeePercent: number;
  groupTripFlatFee: number;
}

export function TransactionFeeSettings({ paidFeePercent: initial, groupTripFlatFee: initialFlat }: Props) {
  const [paidFee, setPaidFee] = useState(String(initial));
  const [flatFee, setFlatFee] = useState(String(initialFlat));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSave() {
    setError("");
    setSuccess(false);

    const paidFeeNum = parseFloat(paidFee);
    const flatFeeNum = parseFloat(flatFee);

    if (isNaN(paidFeeNum) || paidFeeNum < 0 || paidFeeNum > 100) {
      setError("Paid event fee must be between 0 and 100.");
      return;
    }
    if (isNaN(flatFeeNum) || flatFeeNum < 0) {
      setError("Group trip flat fee must be 0 or greater.");
      return;
    }

    setSaving(true);
    const res = await updatePlatformConfig({ paidFeePercent: paidFeeNum, groupTripFlatFee: flatFeeNum });
    setSaving(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSuccess(true);
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        {/* Paid event fee */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Paid event fee
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={paidFee}
              onChange={(e) => { setPaidFee(e.target.value); setSuccess(false); setError(""); }}
              className="w-32 rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-500">%</span>
          </div>
          <p className="mt-1 text-xs text-gray-400">
            Applied to all paid public and invite-only events.
          </p>
        </div>

        {/* Group trip flat fee */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Group trip flat fee
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">KES</span>
            <input
              type="number"
              min="0"
              step="1"
              value={flatFee}
              onChange={(e) => { setFlatFee(e.target.value); setSuccess(false); setError(""); }}
              className="w-32 rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <p className="mt-1 text-xs text-gray-400">
            Flat fee per registration for group trip events.
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}
      {success && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          Transaction fee settings saved.
        </p>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} loading={saving}>
          Save settings
        </Button>
      </div>
    </div>
  );
}
