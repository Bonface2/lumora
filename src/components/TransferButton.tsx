"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { initiateTransfer, cancelTransfer } from "@/app/actions/transfer";

interface Props {
  orderId: string;
  eventTitle: string;
  arrears: number;
  transferFee: number;
  pendingTransfer?: { id: string; toEmail: string; expiresAt: Date } | null;
}

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function TransferButton({ orderId, eventTitle, arrears, transferFee, pendingTransfer }: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [payFee, setPayFee] = useState(false);
  const [payArrears, setPayArrears] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [currentPending, setCurrentPending] = useState(pendingTransfer ?? null);

  const senderTotal = (payFee ? transferFee : 0) + (payArrears ? arrears : 0);
  const recipientTotal = (payFee ? 0 : transferFee) + (payArrears ? 0 : arrears);

  async function handleSend() {
    if (!email.trim()) { setError("Enter an email address."); return; }
    setLoading(true);
    setError("");
    const res = await initiateTransfer(orderId, email.trim(), { payFee, payArrears });
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    if (res.data?.paymentUrl) {
      window.location.href = res.data.paymentUrl;
      return;
    }
    setSent(true);
  }

  async function handleCancel() {
    if (!currentPending) return;
    setCancelLoading(true);
    const res = await cancelTransfer(currentPending.id);
    setCancelLoading(false);
    if (!res.ok) { setError(res.error); return; }
    setCurrentPending(null);
    setOpen(false);
  }

  if (currentPending) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Transfer pending
        </button>

        {open && (
          <Modal onClose={() => setOpen(false)}>
            <h3 className="text-base font-bold text-gray-900">Pending transfer</h3>
            <p className="mt-2 text-sm text-gray-600">
              A transfer for <strong>{eventTitle}</strong> is awaiting acceptance by{" "}
              <strong>{currentPending.toEmail}</strong>.
            </p>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleCancel}
                disabled={cancelLoading}
                className="flex-1 rounded-xl border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                {cancelLoading ? "Cancelling…" : "Cancel transfer"}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </Modal>
        )}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setSent(false); setEmail(""); setError(""); setPayFee(false); setPayArrears(false); }}
        className="flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-4 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100 transition-colors"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
        Transfer ticket
      </button>

      {open && (
        <Modal onClose={() => setOpen(false)}>
          {sent ? (
            <>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-gray-900">Invitation sent</h3>
              <p className="mt-2 text-sm text-gray-600">
                We&apos;ve sent a transfer invitation to <strong>{email}</strong>. Once they accept, the ticket will move to their account.
              </p>
              <button
                onClick={() => { setOpen(false); window.location.reload(); }}
                className="mt-4 w-full rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-700"
              >
                Done
              </button>
            </>
          ) : (
            <>
              <h3 className="text-base font-bold text-gray-900">Transfer ticket</h3>
              <p className="mt-1 text-sm text-gray-500">
                Enter the recipient&apos;s email. They&apos;ll receive an invitation to accept or decline.
              </p>
              <div className="mt-4">
                <label className="mb-1 block text-xs font-semibold text-gray-700">Recipient email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  placeholder="their@email.com"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary-500"
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                />
                {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
              </div>

              {/* Overdue instalments — explicit choice, impossible to miss */}
              {arrears > 0 && (
                <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3.5">
                  <div className="flex items-start gap-2 mb-3">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                    <div>
                      <p className="text-xs font-bold text-amber-800">This order has overdue instalments</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        KES {arrears.toLocaleString()} is outstanding. Choose how to handle this before transferring.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-2.5 transition-colors ${
                      !payArrears ? "border-amber-400 bg-white" : "border-transparent bg-amber-50/60"
                    }`}>
                      <input
                        type="radio"
                        name="arrears"
                        checked={!payArrears}
                        onChange={() => setPayArrears(false)}
                        className="mt-0.5 h-4 w-4 text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-xs text-gray-700">
                        <span className="font-semibold text-gray-900 block">Recipient pays the arrears</span>
                        They must pay KES {arrears.toLocaleString()} when they accept
                      </span>
                    </label>
                    <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-2.5 transition-colors ${
                      payArrears ? "border-primary-400 bg-white" : "border-transparent bg-amber-50/60"
                    }`}>
                      <input
                        type="radio"
                        name="arrears"
                        checked={payArrears}
                        onChange={() => setPayArrears(true)}
                        className="mt-0.5 h-4 w-4 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-xs text-gray-700">
                        <span className="font-semibold text-gray-900 block">I&apos;ll clear the arrears now</span>
                        You pay KES {arrears.toLocaleString()} — recipient gets a clean ticket
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* Transfer fee */}
              <div className="mt-3">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 transition-colors hover:border-gray-300">
                  <input
                    type="checkbox"
                    checked={payFee}
                    onChange={(e) => setPayFee(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-xs text-gray-700">
                    <span className="font-semibold text-gray-900 block">Cover the KES {transferFee.toLocaleString()} transfer fee</span>
                    Recipient won&apos;t be charged anything on acceptance
                  </span>
                </label>
              </div>

              {/* Cost summary */}
              <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 space-y-1 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>You pay now</span>
                  <span className={`font-semibold ${senderTotal > 0 ? "text-gray-900" : "text-gray-400"}`}>
                    {senderTotal > 0 ? `KES ${senderTotal.toLocaleString()}` : "Nothing"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Recipient pays on acceptance</span>
                  <span className={`font-semibold ${recipientTotal > 0 ? "text-amber-700" : "text-gray-400"}`}>
                    {recipientTotal > 0 ? `KES ${recipientTotal.toLocaleString()}` : "Nothing"}
                  </span>
                </div>
              </div>

              <p className="mt-3 text-xs text-gray-400">
                The invitation expires in 24 hours. You can cancel it before they accept.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleSend}
                  disabled={loading}
                  className="flex-1 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-60"
                >
                  {loading
                    ? senderTotal > 0 ? "Redirecting to payment…" : "Sending…"
                    : senderTotal > 0 ? `Pay KES ${senderTotal.toLocaleString()} & send` : "Send invitation"}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
