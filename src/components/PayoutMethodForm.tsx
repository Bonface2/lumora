"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  fetchBanks,
  verifyAccountNumber,
  savePayoutMethod,
  type PayoutMethodData,
} from "@/app/actions/payout";
import type { PaystackBank } from "@/lib/paystack";

type Step = "idle" | "verifying" | "verified" | "manual" | "saving";
const MOBILE_MONEY_TYPES = new Set(["mobile_money", "mobile_money_business"]);

interface FormState {
  label: string;
  bankCode: string;
  bankName: string;
  bankType: string;
  accountNumber: string;
  paybillAccount: string;
  resolvedName: string;
  manualName: string;
  step: Step;
  error: string;
}

const BLANK: FormState = {
  label: "",
  bankCode: "",
  bankName: "",
  bankType: "",
  accountNumber: "",
  paybillAccount: "",
  resolvedName: "",
  manualName: "",
  step: "idle",
  error: "",
};

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500";

interface Props {
  /** Called with the full new method after a successful save */
  onSaved: (method: PayoutMethodData) => void;
  onCancel: () => void;
}

export function PayoutMethodForm({ onSaved, onCancel }: Props) {
  const [form, setForm] = useState<FormState>(BLANK);
  const [banks, setBanks] = useState<PaystackBank[]>([]);
  const [banksLoading, setBanksLoading] = useState(true);

  const isMobileMoney = MOBILE_MONEY_TYPES.has(form.bankType);
  const isPaybill = form.bankCode === "MPPAYBILL";

  useEffect(() => {
    fetchBanks().then((res) => {
      if (res.ok) setBanks(res.data);
      setBanksLoading(false);
    });
  }, []);

  function patch(update: Partial<FormState>) {
    setForm((f) => ({ ...f, ...update }));
  }

  function handleBankChange(code: string) {
    const b = banks.find((b) => b.code === code);
    patch({
      bankCode: code,
      bankName: b?.name ?? "",
      bankType: b?.type ?? "",
      accountNumber: "",
      paybillAccount: "",
      resolvedName: "",
      manualName: "",
      step: "idle",
      error: "",
    });
  }

  async function handleVerify() {
    patch({ error: "", resolvedName: "", manualName: "", step: "verifying" });
    const res = await verifyAccountNumber(form.accountNumber, form.bankCode);
    if (!res.ok) {
      const isRateLimit = res.error.toLowerCase().includes("too many");
      patch({ error: res.error, step: isRateLimit ? "idle" : "manual" });
      return;
    }
    patch({ resolvedName: res.data.accountName, step: "verified" });
  }

  async function handleSave() {
    patch({ error: "", step: "saving" });
    const selected = banks.find((b) => b.code === form.bankCode);
    const effectiveAccountName = isPaybill
      ? form.paybillAccount
      : form.resolvedName || form.manualName;

    const res = await savePayoutMethod({
      label: form.label || undefined,
      bankCode: form.bankCode,
      bankName: selected?.name ?? form.bankName,
      bankType: selected?.type ?? form.bankType,
      accountNumber: form.accountNumber,
      accountName: effectiveAccountName,
    });

    if (!res.ok) {
      const fallbackStep = isMobileMoney ? "idle" : (form.resolvedName ? "verified" : "manual");
      patch({ error: res.error, step: fallbackStep });
      return;
    }

    // Build a PayoutMethodData from what we know to avoid an extra round-trip
    const newMethod: PayoutMethodData = {
      id: res.data.id,
      label: form.label || null,
      paystackBankName: selected?.name ?? form.bankName,
      paystackBankCode: form.bankCode,
      bankType: selected?.type ?? form.bankType,
      paystackAccountNumber: form.accountNumber,
      paystackAccountName: effectiveAccountName || null,
      paystackRecipientCode: "",
    };
    onSaved(newMethod);
  }

  const canSave = isPaybill
    ? form.accountNumber.length >= 4 && form.paybillAccount.length >= 1
    : isMobileMoney
    ? !!form.bankCode && form.accountNumber.length >= 9
    : !!form.resolvedName || (form.step === "manual" && form.manualName.trim().length >= 2);

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
      {/* Label */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Label <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <input
          type="text"
          value={form.label}
          onChange={(e) => patch({ label: e.target.value })}
          placeholder="e.g. Primary M-PESA, Business Account"
          className={inputClass}
        />
      </div>

      {/* Bank selector */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Bank or mobile money</label>
        <select
          value={form.bankCode}
          onChange={(e) => handleBankChange(e.target.value)}
          disabled={banksLoading}
          className={inputClass}
        >
          <option value="">{banksLoading ? "Loading…" : "Select your bank or provider"}</option>
          {banks.filter((b) => MOBILE_MONEY_TYPES.has(b.type)).length > 0 && (
            <optgroup label="Mobile Money">
              {banks.filter((b) => MOBILE_MONEY_TYPES.has(b.type)).map((b) => (
                <option key={b.code} value={b.code}>{b.name}</option>
              ))}
            </optgroup>
          )}
          <optgroup label="Banks">
            {banks.filter((b) => !MOBILE_MONEY_TYPES.has(b.type)).map((b) => (
              <option key={b.code} value={b.code}>{b.name}</option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* Account fields */}
      {form.bankCode && (
        isPaybill ? (
          <>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Paybill number</label>
              <input
                type="text"
                inputMode="numeric"
                value={form.accountNumber}
                onChange={(e) => patch({ accountNumber: e.target.value, step: "idle", error: "" })}
                placeholder="e.g. 123456"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Account number</label>
              <input
                type="text"
                value={form.paybillAccount}
                onChange={(e) => patch({ paybillAccount: e.target.value, error: "" })}
                placeholder="e.g. 0712345678 or your account ref"
                className={inputClass}
              />
            </div>
          </>
        ) : isMobileMoney ? (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {form.bankType === "mobile_money_business" ? "Till number" : "Phone number"}
            </label>
            <input
              type="tel"
              inputMode="numeric"
              value={form.accountNumber}
              onChange={(e) => patch({ accountNumber: e.target.value, step: "idle", error: "" })}
              placeholder={form.bankType === "mobile_money_business" ? "e.g. 123456" : "e.g. 0712345678"}
              className={inputClass}
            />
            <p className="mt-1.5 text-xs text-gray-400">No verification needed — your profile name will be used.</p>
          </div>
        ) : (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Account number</label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={form.accountNumber}
                onChange={(e) => patch({ accountNumber: e.target.value, resolvedName: "", manualName: "", step: "idle", error: "" })}
                placeholder="e.g. 1234567890"
                className={`${inputClass} flex-1`}
              />
              <Button
                onClick={handleVerify}
                loading={form.step === "verifying"}
                disabled={form.accountNumber.length < 6}
                size="sm"
              >
                Verify
              </Button>
            </div>
          </div>
        )
      )}

      {/* Verified */}
      {form.resolvedName && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium text-emerald-600">Account verified</p>
            <p className="text-sm font-bold text-gray-900">{form.resolvedName}</p>
          </div>
        </div>
      )}

      {/* Manual name fallback */}
      {form.step === "manual" && (
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-amber-800">
                {form.error || "Automatic verification unavailable for this bank."}
              </p>
              <p className="mt-0.5 text-xs text-amber-700">
                Enter your account name manually. Double-check it — payouts sent to the wrong account cannot be reversed.
              </p>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Account name <span className="font-normal text-gray-400">(as it appears on your bank statement)</span>
            </label>
            <input
              type="text"
              value={form.manualName}
              onChange={(e) => patch({ manualName: e.target.value })}
              placeholder="e.g. JOHN KAMAU MWANGI"
              className={inputClass}
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Rate-limit / other errors */}
      {form.error && form.step !== "manual" && (
        <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-red-700">{form.error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100"
        >
          Cancel
        </button>
        <Button
          type="button"
          className="flex-1"
          onClick={handleSave}
          loading={form.step === "saving"}
          disabled={!canSave}
        >
          Save method
        </Button>
      </div>

      <p className="text-center text-xs text-gray-400">
        Lumora deducts a platform fee from each sale. The remainder is settled directly to this account.
      </p>
    </div>
  );
}
