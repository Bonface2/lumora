"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  getPayoutAccount,
  fetchBanks,
  verifyAccountNumber,
  savePayoutAccount,
  deletePayoutAccount,
} from "@/app/actions/payout";
import type { PaystackBank } from "@/lib/paystack";

type Step = "idle" | "verifying" | "verified" | "saving" | "done";

const MOBILE_MONEY_TYPES = new Set(["mobile_money", "mobile_money_business"]);

export default function PayoutSettingsPage() {
  const [current, setCurrent] = useState<{
    accountName: string | null;
    accountNumber: string | null;
    bankName: string | null;
    bankType: string | null;
    recipientCode: string | null;
  } | null>(null);
  const [banks, setBanks] = useState<PaystackBank[]>([]);
  const [bankCode, setBankCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankType, setBankType] = useState("");
  const [accountNumber, setAccountNumber] = useState("");   // paybill number OR phone OR bank account
  const [paybillAccount, setPaybillAccount] = useState(""); // paybill: second "account number" field
  const [resolvedName, setResolvedName] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isMobileMoney = MOBILE_MONEY_TYPES.has(bankType);
  const isPaybill = bankCode === "MPPAYBILL";

  useEffect(() => {
    getPayoutAccount().then((acc) => {
      setCurrent(acc);
      setEditing(!acc.recipientCode);
    });
    fetchBanks().then((res) => {
      if (res.ok) setBanks(res.data);
    });
  }, []);

  async function handleVerify() {
    setError("");
    setResolvedName("");
    setStep("verifying");
    const res = await verifyAccountNumber(accountNumber, bankCode);
    if (!res.ok) {
      setError(res.error);
      setStep("idle");
      return;
    }
    setResolvedName(res.data.accountName);
    setStep("verified");
  }

  async function handleSave() {
    setError("");
    setStep("saving");
    const selected = banks.find((b) => b.code === bankCode);
    const res = await savePayoutAccount({
      bankCode,
      bankName: selected?.name ?? bankName,
      bankType: selected?.type ?? bankType,
      accountNumber,
      // for paybill: accountName holds the paybill account ref; for others: the resolved/display name
      accountName: isPaybill ? paybillAccount : resolvedName,
    });
    if (!res.ok) {
      setError(res.error);
      setStep(isMobileMoney ? "idle" : "verified");
      return;
    }
    setCurrent({
      accountName: isPaybill ? paybillAccount : (resolvedName || accountNumber),
      accountNumber,
      bankName: selected?.name ?? bankName,
      bankType: selected?.type ?? bankType,
      recipientCode: res.data.recipientCode,
    });
    setEditing(false);
    setStep("done");
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await deletePayoutAccount();
    if (!res.ok) { setDeleting(false); return; }
    setCurrent({ accountName: null, accountNumber: null, bankName: null, bankType: null, recipientCode: null });
    setConfirmDelete(false);
    setEditing(false);
    setDeleting(false);
  }

  function handleBankChange(code: string) {
    setBankCode(code);
    const b = banks.find((b) => b.code === code);
    setBankName(b?.name ?? "");
    setBankType(b?.type ?? "");
    setAccountNumber("");
    setPaybillAccount("");
    setResolvedName("");
    setStep("idle");
    setError("");
  }

  function handleAccountNumberChange(val: string) {
    setAccountNumber(val);
    setResolvedName("");
    setStep("idle");
    setError("");
  }

  const canSave = isPaybill
    ? accountNumber.length >= 4 && paybillAccount.length >= 1
    : isMobileMoney
    ? !!bankCode && accountNumber.length >= 9
    : !!resolvedName;

  return (
    <div className="min-h-full bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-gray-900">Payout settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Set up your payout account to receive transfers when Lumora settles your ticket sales.
            Lumora retains a 6% platform fee on each transaction.
          </p>
        </div>

        {/* Current account card */}
        {current?.recipientCode && !editing && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-1">
                  Active payout account
                </p>
                <p className="text-lg font-bold text-gray-900">{current.bankName}</p>
                <p className="text-sm text-gray-600">
                  {current.bankType === "mobile_money_business" && current.accountNumber ? (
                    <>Paybill/Till: {current.accountNumber}{current.accountName ? ` · Account: ${current.accountName}` : ""}</>
                  ) : current.bankType === "mobile_money" ? (
                    current.accountNumber
                  ) : (
                    `****${current.accountNumber?.slice(-4)}${current.accountName ? ` · ${current.accountName}` : ""}`
                  )}
                </p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <button
                onClick={() => { setEditing(true); setConfirmDelete(false); setStep("idle"); setError(""); }}
                className="text-sm font-semibold text-emerald-700 hover:underline"
              >
                Update
              </button>
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-sm font-semibold text-red-500 hover:underline"
                >
                  Remove
                </button>
              ) : (
                <span className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600">Remove payout account?</span>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="font-semibold text-red-600 hover:underline disabled:opacity-50"
                  >
                    {deleting ? "Removing…" : "Yes, remove"}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="font-semibold text-gray-500 hover:underline"
                  >
                    Cancel
                  </button>
                </span>
              )}
            </div>
          </div>
        )}

        {/* No account warning */}
        {!current?.recipientCode && !editing && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-semibold text-amber-800">
              You haven&apos;t set up a payout account yet.
            </p>
            <p className="mt-1 text-sm text-amber-700">
              Ticket sales will not be transferred to you until you add your payout details.
            </p>
          </div>
        )}

        {/* Setup form */}
        {editing && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-5">
            <h2 className="text-base font-bold text-gray-900">
              {current?.recipientCode ? "Update payout account" : "Add payout account"}
            </h2>

            {/* Bank / provider selector */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Bank or mobile money</label>
              <select
                value={bankCode}
                onChange={(e) => handleBankChange(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">Select your bank or provider</option>
                {banks.filter((b) => MOBILE_MONEY_TYPES.has(b.type)).length > 0 && (
                  <optgroup label="Mobile Money">
                    {banks
                      .filter((b) => MOBILE_MONEY_TYPES.has(b.type))
                      .map((b) => (
                        <option key={b.code} value={b.code}>{b.name}</option>
                      ))}
                  </optgroup>
                )}
                <optgroup label="Banks">
                  {banks
                    .filter((b) => !MOBILE_MONEY_TYPES.has(b.type))
                    .map((b) => (
                      <option key={b.code} value={b.code}>{b.name}</option>
                    ))}
                </optgroup>
              </select>
            </div>

            {/* Fields — vary by type */}
            {bankCode && (
              <>
                {/* Paybill: two fields */}
                {isPaybill ? (
                  <>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">Paybill number</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={accountNumber}
                        onChange={(e) => handleAccountNumberChange(e.target.value)}
                        placeholder="e.g. 123456"
                        className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">Account number</label>
                      <input
                        type="text"
                        value={paybillAccount}
                        onChange={(e) => { setPaybillAccount(e.target.value); setError(""); }}
                        placeholder="e.g. 0712345678 or your account ref"
                        className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                      <p className="mt-1.5 text-xs text-gray-400">
                        The account number associated with this paybill.
                      </p>
                    </div>
                  </>
                ) : isMobileMoney ? (
                  /* Till / plain mobile money: one field */
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      {bankType === "mobile_money_business" ? "Till number" : "Phone number"}
                    </label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={accountNumber}
                      onChange={(e) => handleAccountNumberChange(e.target.value)}
                      placeholder={bankType === "mobile_money_business" ? "e.g. 123456" : "e.g. 0712345678"}
                      className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                    <p className="mt-1.5 text-xs text-gray-400">
                      No verification needed — your profile name will be used as the recipient name.
                    </p>
                  </div>
                ) : (
                  /* Bank account: number + verify */
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Account number</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={accountNumber}
                        onChange={(e) => handleAccountNumberChange(e.target.value)}
                        placeholder="e.g. 1234567890"
                        className="flex-1 rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                      <Button
                        onClick={handleVerify}
                        loading={step === "verifying"}
                        disabled={accountNumber.length < 6}
                        size="sm"
                      >
                        Verify
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Resolved name (bank accounts only) */}
            {resolvedName && (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <svg className="h-5 w-5 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <p className="text-xs text-emerald-600">Account verified</p>
                  <p className="text-sm font-bold text-gray-900">{resolvedName}</p>
                </div>
              </div>
            )}

            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
            )}

            <div className="flex gap-3 pt-1">
              {current?.recipientCode && (
                <button
                  onClick={() => setEditing(false)}
                  className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              )}
              <Button
                className="flex-1"
                onClick={handleSave}
                loading={step === "saving"}
                disabled={!canSave}
              >
                Save payout account
              </Button>
            </div>

            <p className="text-center text-xs text-gray-400">
              Lumora retains 6% of each sale. The remaining 94% is settled directly to this account.
            </p>
          </div>
        )}

        {step === "done" && (
          <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            Payout account saved — you&apos;re all set to receive payments.
          </div>
        )}
      </div>
    </div>
  );
}
