"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  approveGroupTrip,
  rejectGroupTrip,
  approveExpansionRequest,
  rejectExpansionRequest,
} from "@/app/actions/admin";

// ── Approve group trip ──────────────────────────────────────────────────────

export function ApproveGroupTripButton({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (done) return <span className="text-xs font-semibold text-emerald-600">Approved</span>;

  async function handle() {
    if (!confirm(`Approve group trip "${eventTitle}"? The seller will be notified and can publish their event.`)) return;
    setLoading(true);
    const res = await approveGroupTrip(eventId);
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    setDone(true);
    router.refresh();
  }

  return (
    <div>
      <button
        onClick={handle}
        disabled={loading}
        className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors"
      >
        {loading ? "Approving…" : "Approve"}
      </button>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ── Reject group trip ───────────────────────────────────────────────────────

export function RejectGroupTripButton({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (done) return <span className="text-xs font-semibold text-red-500">Rejected</span>;

  async function handle() {
    if (!reason.trim()) { setError("Provide a reason."); return; }
    setLoading(true);
    const res = await rejectGroupTrip(eventId, reason.trim());
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    setDone(true);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
      >
        Reject
      </button>
    );
  }

  return (
    <div className="space-y-1.5 min-w-[200px]">
      <p className="text-xs font-semibold text-gray-700">Reason for rejection:</p>
      <textarea
        value={reason}
        onChange={(e) => { setReason(e.target.value); setError(""); }}
        rows={2}
        placeholder={`e.g. "${eventTitle}" appears to be a commercial tour`}
        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-red-400"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-1.5">
        <button
          onClick={handle}
          disabled={loading}
          className="rounded-xl bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {loading ? "Rejecting…" : "Confirm reject"}
        </button>
        <button onClick={() => setOpen(false)} className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Approve expansion request ───────────────────────────────────────────────

export function ApproveExpansionButton({ requestId, eventTitle, additional }: { requestId: string; eventTitle: string; additional: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (done) return <span className="text-xs font-semibold text-emerald-600">Approved</span>;

  async function handle() {
    if (!confirm(`Approve +${additional} slots for "${eventTitle}"?`)) return;
    setLoading(true);
    const res = await approveExpansionRequest(requestId);
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    setDone(true);
    router.refresh();
  }

  return (
    <div>
      <button
        onClick={handle}
        disabled={loading}
        className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors"
      >
        {loading ? "Approving…" : "Approve"}
      </button>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ── Reject expansion request ────────────────────────────────────────────────

export function RejectExpansionButton({ requestId, eventTitle }: { requestId: string; eventTitle: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (done) return <span className="text-xs font-semibold text-red-500">Rejected</span>;

  async function handle() {
    if (!note.trim()) { setError("Provide a note."); return; }
    setLoading(true);
    const res = await rejectExpansionRequest(requestId, note.trim());
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    setDone(true);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
      >
        Reject
      </button>
    );
  }

  return (
    <div className="space-y-1.5 min-w-[200px]">
      <p className="text-xs font-semibold text-gray-700">Note for seller:</p>
      <textarea
        value={note}
        onChange={(e) => { setNote(e.target.value); setError(""); }}
        rows={2}
        placeholder={`e.g. "${eventTitle}" already has sufficient capacity`}
        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs outline-none focus:border-red-400"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-1.5">
        <button
          onClick={handle}
          disabled={loading}
          className="rounded-xl bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {loading ? "Rejecting…" : "Confirm reject"}
        </button>
        <button onClick={() => setOpen(false)} className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </div>
  );
}
