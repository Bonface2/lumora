"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { payInstallment } from "@/app/actions/orders";

type PaymentMode = "installment" | "complete" | "custom";

interface PaymentPreview {
  eventTitle: string;
  eventDate: string;
  venue: string;
  categoryName: string;
  installmentNumber: number;
  amount: number;           // remaining due on this installment
  installmentTotal: number; // original scheduled amount
  installmentPaid: number;  // already paid toward this installment
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
}

const MODE_OPTIONS: { value: PaymentMode; label: string; description: (p: PaymentPreview) => string }[] = [
  {
    value: "installment",
    label: "Pay what's due",
    description: (p) =>
      p.installmentPaid > 0
        ? `KES ${p.amount.toLocaleString()} — Installment #${p.installmentNumber} (KES ${p.installmentPaid.toLocaleString()} already applied), due ${format(new Date(p.dueDate), "dd MMM yyyy")}`
        : `KES ${p.amount.toLocaleString()} — Installment #${p.installmentNumber}, due ${format(new Date(p.dueDate), "dd MMM yyyy")}`,
  },
  {
    value: "complete",
    label: "Complete payment",
    description: (p) => `KES ${p.remainingAmount.toLocaleString()} — Pay off the full remaining balance`,
  },
  {
    value: "custom",
    label: "Custom amount",
    description: () => "Enter any amount — surplus rolls into your next installment",
  },
];

export default function PayInstallmentPage() {
  const { id: orderId } = useParams<{ id: string }>();
  const router = useRouter();
  const [preview, setPreview] = useState<PaymentPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<PaymentMode>("installment");
  const [customAmount, setCustomAmount] = useState("");
  const [customError, setCustomError] = useState("");

  useEffect(() => {
    fetch(`/api/buyer/orders/${orderId}/next-payment`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setPreview(d);
        setLoading(false);
      })
      .catch(() => { setError("Failed to load payment details."); setLoading(false); });
  }, [orderId]);

  function getChargeAmount(): number | null {
    if (!preview) return null;
    if (mode === "installment") return preview.amount;
    if (mode === "complete") return preview.remainingAmount;
    const n = parseFloat(customAmount);
    return isNaN(n) ? null : n;
  }

  async function handlePay() {
    if (!preview) return;
    setCustomError("");
    setError("");

    if (mode === "custom") {
      const n = parseFloat(customAmount);
      if (!customAmount || isNaN(n) || n <= 0) {
        setCustomError("Enter a valid amount.");
        return;
      }
      if (n > preview.remainingAmount + 0.01) {
        setCustomError(`Cannot exceed remaining balance of KES ${preview.remainingAmount.toLocaleString()}.`);
        return;
      }
    }

    setPaying(true);
    const res = await payInstallment(orderId, {
      mode,
      customAmount: mode === "custom" ? parseFloat(customAmount) : undefined,
    });
    if (!res.ok) {
      setError(res.error);
      setPaying(false);
      return;
    }
    window.location.href = res.data.paymentUrl;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        {error || "Payment not found."}
      </div>
    );
  }

  const progressPct = Math.min(100, Math.round((preview.paidAmount / preview.totalAmount) * 100));
  const chargeAmount = getChargeAmount();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <a href="/" className="text-xl font-bold text-primary-600">Lumora</a>
        </div>

        <Card>
          <CardHeader>
            <h1 className="font-semibold text-gray-900">Make a payment</h1>
          </CardHeader>
          <CardBody className="space-y-5">
            {/* Event summary */}
            <div>
              <p className="font-medium text-gray-900">{preview.eventTitle}</p>
              <p className="text-sm text-gray-500">
                {format(new Date(preview.eventDate), "dd MMM yyyy · HH:mm")} · {preview.venue}
              </p>
            </div>

            {/* Progress */}
            <div className="rounded-lg bg-gray-50 p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Ticket type</span>
                <span className="font-medium">{preview.categoryName}</span>
              </div>
              <div className="border-t border-gray-200 pt-2">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Payment progress</span>
                  <span>KES {preview.paidAmount.toLocaleString()} / {preview.totalAmount.toLocaleString()}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-gray-200">
                  <div
                    className="h-1.5 rounded-full bg-primary-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-xs text-gray-400">
                  KES {preview.remainingAmount.toLocaleString()} remaining
                </p>
              </div>
            </div>

            {/* Payment mode selector */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">How much would you like to pay?</p>
              {MODE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                    mode === opt.value
                      ? "border-primary-500 bg-primary-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMode"
                    value={opt.value}
                    checked={mode === opt.value}
                    onChange={() => { setMode(opt.value); setCustomError(""); }}
                    className="mt-0.5 accent-primary-600"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                    <p className="text-xs text-gray-500">{opt.description(preview)}</p>
                  </div>
                  {opt.value !== "custom" && mode === opt.value && (
                    <span className="text-sm font-bold text-primary-600 shrink-0">
                      KES {(opt.value === "installment" ? preview.amount : preview.remainingAmount).toLocaleString()}
                    </span>
                  )}
                </label>
              ))}

              {mode === "custom" && (
                <div className="rounded-xl border border-gray-200 p-3 space-y-2">
                  <label className="text-xs text-gray-500">
                    Enter amount (max KES {preview.remainingAmount.toLocaleString()})
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-500">KES</span>
                    <input
                      type="number"
                      min={1}
                      max={preview.remainingAmount}
                      step={1}
                      value={customAmount}
                      onChange={(e) => { setCustomAmount(e.target.value); setCustomError(""); }}
                      placeholder="0"
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  {customError && <p className="text-xs text-red-600">{customError}</p>}
                </div>
              )}
            </div>

            {/* Charge summary */}
            {chargeAmount !== null && chargeAmount > 0 && (
              <div className="flex items-center justify-between border-t pt-3">
                <span className="font-semibold text-gray-900">You&apos;ll pay</span>
                <span className="text-xl font-bold text-primary-600">
                  KES {chargeAmount.toLocaleString()}
                </span>
              </div>
            )}

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <Button
              className="w-full"
              size="lg"
              loading={paying}
              onClick={handlePay}
              disabled={mode === "custom" && (!customAmount || parseFloat(customAmount) <= 0)}
            >
              Pay securely
            </Button>

            <button
              type="button"
              onClick={() => router.push("/buyer")}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
            >
              ← Back to my tickets
            </button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
