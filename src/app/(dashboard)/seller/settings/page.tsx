"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  getPayoutMethods,
  fetchBanks,
  verifyAccountNumber,
  savePayoutMethod,
  updatePayoutMethod,
  deletePayoutMethod,
  type PayoutMethodData,
} from "@/app/actions/payout";
import type { PaystackBank } from "@/lib/paystack";

type Step = "idle" | "verifying" | "verified" | "manual" | "saving";
const MOBILE_MONEY_TYPES = new Set(["mobile_money", "mobile_money_business"]);

function accountDisplay(m: PayoutMethodData) {
  if (m.bankType === "mobile_money_business") {
    return `Paybill: ${m.paystackAccountNumber}${m.paystackAccountName ? ` · Acc: ${m.paystackAccountName}` : ""}`;
  }
  if (m.bankType === "mobile_money") return m.paystackAccountNumber;
  return `****${m.paystackAccountNumber.slice(-4)}${m.paystackAccountName ? ` · ${m.paystackAccountName}` : ""}`;
}

function BankIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
    </svg>
  );
}

interface FormState {
  editingId: string | null;
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

const BLANK_FORM: FormState = {
  editingId: null,
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

export default function PayoutSettingsPage() {
  const [methods, setMethods] = useState<PayoutMethodData[]>([]);
  const [banks, setBanks] = useState<PaystackBank[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(BLANK_FORM);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const isMobileMoney = MOBILE_MONEY_TYPES.has(form.bankType);
  const isPaybill = form.bankCode === "MPPAYBILL";

  useEffect(() => {
    getPayoutMethods().then(setMethods);
    fetchBanks().then((res) => { if (res.ok) setBanks(res.data); });
  }, []);

  function openAdd() {
    setForm(BLANK_FORM);
    setShowForm(true);
    setSavedMsg("");
  }

  function openEdit(m: PayoutMethodData) {
    setForm({
      editingId: m.id,
      label: m.label ?? "",
      bankCode: m.paystackBankCode,
      bankName: m.paystackBankName,
      bankType: m.bankType,
      accountNumber: m.paystackAccountNumber,
      paybillAccount: m.bankType === "mobile_money_business" ? (m.paystackAccountName ?? "") : "",
      resolvedName: m.bankType !== "mobile_money" && m.bankType !== "mobile_money_business"
        ? (m.paystackAccountName ?? "") : "",
      manualName: "",
      step: "idle",
      error: "",
    });
    setShowForm(true);
    setSavedMsg("");
  }

  function closeForm() {
    setShowForm(false);
    setForm(BLANK_FORM);
  }

  function patch(update: Partial<FormState>) {
    setForm((f) => ({ ...f, ...update }));
  }

  function handleBankChange(code: string) {
    const b = banks.find((b) => b.code === code);
    patch({ bankCode: code, bankName: b?.name ?? "", bankType: b?.type ?? "", accountNumber: "", paybillAccount: "", resolvedName: "", manualName: "", step: "idle", error: "" });
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
    const payload = {
      label: form.label || undefined,
      bankCode: form.bankCode,
      bankName: selected?.name ?? form.bankName,
      bankType: selected?.type ?? form.bankType,
      accountNumber: form.accountNumber,
      accountName: effectiveAccountName,
    };

    const res = form.editingId
      ? await updatePayoutMethod(form.editingId, payload)
      : await savePayoutMethod(payload);

    if (!res.ok) {
      const fallbackStep = isMobileMoney ? "idle" : (form.resolvedName ? "verified" : "manual");
      patch({ error: res.error, step: fallbackStep });
      return;
    }

    const updated = await getPayoutMethods();
    setMethods(updated);
    setSavedMsg(form.editingId ? "Payout method updated." : "Payout method added.");
    closeForm();
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    const res = await deletePayoutMethod(id);
    if (res.ok) {
      setMethods((prev) => prev.filter((m) => m.id !== id));
      setConfirmDeleteId(null);
    }
    setDeleting(false);
  }

  const canSave = isPaybill
    ? form.accountNumber.length >= 4 && form.paybillAccount.length >= 1
    : isMobileMoney
    ? !!form.bankCode && form.accountNumber.length >= 9
    : !!form.resolvedName || (form.step === "manual" && form.manualName.trim().length >= 2);

  return (
    <div className="min-h-full bg-gray-50">
      {/* Page header */}
      <div className="border-b border-gray-200 bg-white px-6 py-6 sm:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Payout methods</h1>
            <p className="mt-1 text-sm text-gray-500">
              Where Lumora sends your ticket sales revenue after the platform fee is deducted.
            </p>
          </div>
          {!showForm && methods.length > 0 && (
            <button
              onClick={openAdd}
              className="flex shrink-0 items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add method
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-8 sm:px-8">

        {savedMsg && !showForm && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-emerald-800">{savedMsg}</p>
          </div>
        )}

        {/* Empty state */}
        {methods.length === 0 && !showForm && (
          <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gray-200 bg-white px-8 py-16 text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              <BankIcon className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-base font-bold text-gray-900">No payout methods yet</h2>
            <p className="mt-2 max-w-xs text-sm text-gray-500">
              Add a bank account or M-PESA number so Lumora can send you your earnings after each event.
            </p>
            <button
              onClick={openAdd}
              className="mt-6 flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add your first method
            </button>
          </div>
        )}

        {/* Method cards */}
        {methods.length > 0 && !showForm && (
          <div className="space-y-3">
            {methods.map((m, idx) => (
              <div
                key={m.id}
                className="group flex items-center gap-5 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm transition-shadow hover:shadow-md"
              >
                {/* Icon */}
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                  {MOBILE_MONEY_TYPES.has(m.bankType) ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18h3" />
                    </svg>
                  ) : (
                    <BankIcon className="h-5 w-5" />
                  )}
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-gray-900">{m.paystackBankName}</span>
                    {m.label && (
                      <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary-700">
                        {m.label}
                      </span>
                    )}
                    {idx === 0 && methods.length > 1 && (
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                        Default
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-gray-500">{accountDisplay(m)}</p>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1">
                  {confirmDeleteId !== m.id ? (
                    <>
                      <button
                        onClick={() => openEdit(m)}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(m.id)}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2">
                      <span className="text-xs text-gray-600">Remove?</span>
                      <button
                        onClick={() => handleDelete(m.id)}
                        disabled={deleting}
                        className="text-xs font-bold text-red-600 hover:underline disabled:opacity-50"
                      >
                        {deleting ? "Removing…" : "Yes"}
                      </button>
                      <span className="text-gray-300">·</span>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-xs font-semibold text-gray-500 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            <p className="pt-1 text-center text-xs text-gray-400">
              You can assign a different payout method to each event when creating or editing it.
            </p>
          </div>
        )}

        {/* Add / Edit form */}
        {showForm && (
          <div className="rounded-3xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-5">
              <h2 className="text-base font-bold text-gray-900">
                {form.editingId ? "Update payout method" : "Add payout method"}
              </h2>
              <p className="mt-0.5 text-sm text-gray-500">
                {form.editingId
                  ? "Change the details for this payout destination."
                  : "Connect a bank account or mobile money number."}
              </p>
            </div>

            <div className="space-y-5 px-6 py-6">
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

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Bank or mobile money</label>
                <select
                  value={form.bankCode}
                  onChange={(e) => handleBankChange(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select your bank or provider</option>
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
                    <p className="mt-1.5 text-xs text-gray-400">
                      No verification needed — your profile name will be used.
                    </p>
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

              {form.error && form.step !== "manual" && (
                <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <p className="text-sm text-red-700">{form.error}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 border-t border-gray-100 px-6 py-5">
              <button
                onClick={closeForm}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <Button className="flex-1" onClick={handleSave} loading={form.step === "saving"} disabled={!canSave}>
                {form.editingId ? "Update method" : "Save method"}
              </Button>
            </div>

            <p className="pb-5 text-center text-xs text-gray-400">
              Lumora deducts a platform fee from each sale. The remainder is settled directly to this account.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
