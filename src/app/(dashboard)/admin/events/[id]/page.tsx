"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { setEventPlatformFee, getAdminEvent } from "@/app/actions/admin";
import { PLATFORM_FEE_PERCENT } from "@/lib/paystack";

type EventData = Awaited<ReturnType<typeof getAdminEvent>>;

export default function AdminEventFeePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<EventData>(null);
  const [feeInput, setFeeInput] = useState("");
  const [useDefault, setUseDefault] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    getAdminEvent(id).then((e) => {
      setEvent(e);
      if (e?.platformFeePercent !== null && e?.platformFeePercent !== undefined) {
        setFeeInput(String(Number(e.platformFeePercent)));
        setUseDefault(false);
      } else {
        setUseDefault(true);
      }
    });
  }, [id]);

  async function handleSave() {
    setError("");
    setSuccess(false);
    setSaving(true);

    const feePercent = useDefault ? null : parseFloat(feeInput);

    if (!useDefault && (isNaN(feePercent!) || feePercent! < 0 || feePercent! > 100)) {
      setError("Enter a valid percentage between 0 and 100.");
      setSaving(false);
      return;
    }

    const res = await setEventPlatformFee(id, feePercent);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSuccess(true);
  }

  if (!event) {
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-lg">
        <div className="mb-6">
          <a href="/admin/events" className="text-sm text-primary-600 hover:underline">
            ← All events
          </a>
          <h1 className="mt-2 text-2xl font-black text-gray-900">Platform fee</h1>
          <p className="mt-1 text-sm text-gray-500">{event.title}</p>
          <p className="text-xs text-gray-400">
            {event.seller.name ?? event.seller.email} ·{" "}
            {new Date(event.date).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-5">
          {/* Use default toggle */}
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useDefault}
                  onChange={(e) => {
                    setUseDefault(e.target.checked);
                    setError("");
                    setSuccess(false);
                    if (e.target.checked) setFeeInput("");
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Use global default ({PLATFORM_FEE_PERCENT}%)
                </span>
              </label>
              <p className="mt-1 ml-7 text-xs text-gray-400">
                Uncheck to negotiate a custom rate for this event.
              </p>
            </div>
          </div>

          {/* Custom fee input */}
          {!useDefault && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Custom platform fee (%)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={feeInput}
                  onChange={(e) => {
                    setFeeInput(e.target.value);
                    setError("");
                    setSuccess(false);
                  }}
                  placeholder={`e.g. ${PLATFORM_FEE_PERCENT}`}
                  className="w-36 rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
              {feeInput && !isNaN(parseFloat(feeInput)) && (
                <p className="mt-2 text-xs text-gray-500">
                  On a KES 1,000 ticket: Lumora keeps{" "}
                  <span className="font-semibold text-gray-700">
                    KES {(1000 * parseFloat(feeInput) / 100).toFixed(2)}
                  </span>{" "}
                  and the seller receives{" "}
                  <span className="font-semibold text-gray-700">
                    KES {(1000 - 1000 * parseFloat(feeInput) / 100).toFixed(2)}
                  </span>.
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          )}
          {success && (
            <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              Fee updated successfully.
            </p>
          )}

          <Button onClick={handleSave} loading={saving} className="w-full">
            Save fee
          </Button>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          This rate applies to all new payments for this event. Existing completed transactions are not affected.
        </p>
      </div>
    </div>
  );
}
