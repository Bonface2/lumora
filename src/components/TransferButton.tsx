"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { initiateTransfer, cancelTransfer } from "@/app/actions/transfer";

interface Props {
  orderId: string;
  eventTitle: string;
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

export function TransferButton({ orderId, eventTitle, pendingTransfer }: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [currentPending, setCurrentPending] = useState(pendingTransfer ?? null);

  async function handleSend() {
    if (!email.trim()) { setError("Enter an email address."); return; }
    setLoading(true);
    setError("");
    const res = await initiateTransfer(orderId, email.trim());
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
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
        onClick={() => { setOpen(true); setSent(false); setEmail(""); setError(""); }}
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
              <p className="mt-3 text-xs text-gray-400">
                The invitation expires in 24 hours. You can cancel it before they accept.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleSend}
                  disabled={loading}
                  className="flex-1 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-60"
                >
                  {loading ? "Sending…" : "Send invitation"}
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
