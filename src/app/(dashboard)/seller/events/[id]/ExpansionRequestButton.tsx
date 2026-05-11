"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { requestCapacityExpansion } from "@/app/actions/events";

interface Props {
  eventId: string;
  currentCapacity: number;
  totalSold: number;
  existingRequest: { status: string; requestedAdditional: number } | null;
}

interface Invitee {
  name: string;
  email: string;
  phone: string;
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
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function ExpansionRequestButton({ eventId, currentCapacity, totalSold, existingRequest }: Props) {
  const [open, setOpen] = useState(false);
  const [additionalCount, setAdditionalCount] = useState("");
  const [reason, setReason] = useState("");
  const [invitees, setInvitees] = useState<Invitee[]>([{ name: "", email: "", phone: "" }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  // Already has an existing request
  if (existingRequest) {
    const statusLabel =
      existingRequest.status === "APPROVED" ? "Approved" :
      existingRequest.status === "REJECTED" ? "Declined" : "Under review";
    const statusCls =
      existingRequest.status === "APPROVED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
      existingRequest.status === "REJECTED" ? "bg-red-50 text-red-700 border-red-200" :
      "bg-amber-50 text-amber-700 border-amber-200";

    return (
      <div className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm ${statusCls}`}>
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>
          Expansion request (+{existingRequest.requestedAdditional} guests): <strong>{statusLabel}</strong>
        </span>
      </div>
    );
  }

  // Only show button if at or near capacity
  const atCapacity = currentCapacity > 0 && totalSold >= Math.max(1, currentCapacity - 2);
  if (!atCapacity) return null;

  function addInvitee() {
    setInvitees((prev) => [...prev, { name: "", email: "", phone: "" }]);
  }

  function removeInvitee(i: number) {
    setInvitees((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateInvitee(i: number, field: keyof Invitee, value: string) {
    setInvitees((prev) => prev.map((inv, idx) => idx === i ? { ...inv, [field]: value } : inv));
  }

  async function handleSubmit() {
    const n = parseInt(additionalCount, 10);
    if (isNaN(n) || n < 1) { setError("Enter a valid number of additional guests."); return; }
    if (!reason.trim()) { setError("Provide a reason for the expansion request."); return; }
    const filledInvitees = invitees.filter((inv) => inv.email.trim() || inv.phone.trim());
    if (filledInvitees.length === 0) { setError("Add at least one invitee."); return; }
    if (filledInvitees.some((inv) => !inv.email.trim())) { setError("Every invitee must have an email address."); return; }
    if (filledInvitees.some((inv) => !inv.phone.trim())) { setError("Every invitee must have a phone number."); return; }

    setLoading(true);
    setError("");
    const res = await requestCapacityExpansion(eventId, {
      requestedAdditional: n,
      reason: reason.trim(),
      invitees: filledInvitees,
    });
    setLoading(false);

    if (!res.ok) { setError(res.error); return; }
    setSent(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Request capacity expansion
      </button>

      {open && (
        <Modal onClose={() => setOpen(false)}>
          {sent ? (
            <>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-gray-900">Request submitted</h3>
              <p className="mt-2 text-sm text-gray-600">
                Our team will review your request and get back to you by email. This is a one-time request per event.
              </p>
              <button
                onClick={() => setOpen(false)}
                className="mt-4 w-full rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-700"
              >
                Done
              </button>
            </>
          ) : (
            <>
              <h3 className="text-base font-bold text-gray-900">Request capacity expansion</h3>
              <p className="mt-1 text-sm text-gray-500">
                Current capacity: <strong>{currentCapacity} guests</strong>. This is a one-time request per event.
                You must provide details of the additional guests.
              </p>

              <div className="mt-4 space-y-4">
                {/* Additional count */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700">
                    How many additional guests?
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={additionalCount}
                    onChange={(e) => { setAdditionalCount(e.target.value); setError(""); }}
                    placeholder="e.g. 5"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary-500"
                  />
                </div>

                {/* Reason */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700">
                    Reason for expansion
                  </label>
                  <textarea
                    rows={2}
                    value={reason}
                    onChange={(e) => { setReason(e.target.value); setError(""); }}
                    placeholder="e.g. Additional family members joining the trip"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary-500"
                  />
                </div>

                {/* Invitees */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-700">
                      Additional guest details
                    </label>
                    <button
                      type="button"
                      onClick={addInvitee}
                      className="text-xs text-primary-600 hover:text-primary-700 font-semibold"
                    >
                      + Add guest
                    </button>
                  </div>
                  <div className="space-y-2.5">
                    {invitees.map((inv, i) => (
                      <div key={i} className="rounded-xl border border-gray-100 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-500">Guest {i + 1}</span>
                          {invitees.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeInvitee(i)}
                              className="text-xs text-red-500 hover:text-red-600"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          placeholder="Full name (optional)"
                          value={inv.name}
                          onChange={(e) => updateInvitee(i, "name", e.target.value)}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-primary-500"
                        />
                        <input
                          type="email"
                          placeholder="Email address *"
                          value={inv.email}
                          onChange={(e) => updateInvitee(i, "email", e.target.value)}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-primary-500"
                        />
                        <input
                          type="tel"
                          placeholder="Phone number *"
                          value={inv.phone}
                          onChange={(e) => updateInvitee(i, "phone", e.target.value)}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-primary-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-60 transition-colors"
                >
                  {loading ? "Submitting…" : "Submit request"}
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
