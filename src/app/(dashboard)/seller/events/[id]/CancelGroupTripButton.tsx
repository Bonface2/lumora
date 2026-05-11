"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cancelGroupTrip } from "@/app/actions/events";

interface Props {
  eventId: string;
  isDraft: boolean;
  totalCollected: number;
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
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function CancelGroupTripButton({ eventId, isDraft, totalCollected }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hasFunds = !isDraft && totalCollected > 0;

  async function handleCancel() {
    setLoading(true);
    setError("");
    const res = await cancelGroupTrip(eventId);
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    router.push("/seller");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-colors"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        Cancel trip
      </button>

      {open && (
        <Modal onClose={() => !loading && setOpen(false)}>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h3 className="text-base font-black text-gray-900">Cancel this group trip?</h3>

          {isDraft ? (
            <p className="mt-2 text-sm text-gray-500">
              This trip is in draft and has no participants. It will be permanently cancelled and cannot be undone.
            </p>
          ) : hasFunds ? (
            <div className="mt-2 space-y-3">
              <p className="text-sm text-gray-500">
                This will cancel the trip for all participants. Because payments have been collected, our team will process a disbursement to your account.
              </p>
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-xs font-semibold text-amber-800">Disbursement</p>
                <p className="mt-0.5 text-sm text-amber-700">
                  <strong>KES {totalCollected.toLocaleString()}</strong> collected from participants, less accrued platform fees, will be disbursed to your account within 5–10 business days.
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-500">
              This trip will be cancelled. No payments have been collected so there is nothing to disburse.
            </p>
          )}

          {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

          <div className="mt-5 flex gap-2">
            <button
              onClick={handleCancel}
              disabled={loading}
              className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
            >
              {loading ? "Cancelling…" : "Yes, cancel trip"}
            </button>
            <button
              onClick={() => setOpen(false)}
              disabled={loading}
              className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Keep trip
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
