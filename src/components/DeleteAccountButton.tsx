"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { deleteMyAccount } from "@/app/actions/account";

export function DeleteAccountButton() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setLoading(true);
    setError("");
    const res = await deleteMyAccount();
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    await signOut({ callbackUrl: "/" });
  }

  return (
    <>
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6">
        <h3 className="text-sm font-bold text-red-800">Delete account</h3>
        <p className="mt-1 text-sm text-red-600">
          Permanently removes your personal data. Your purchase history is anonymised and retained for legal compliance. This action cannot be undone.
        </p>
        <button
          onClick={() => setOpen(true)}
          className="mt-4 rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
        >
          Delete my account
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-black text-gray-900">Are you absolutely sure?</h2>
            <p className="mt-2 text-sm text-gray-500">
              Your name, email, and phone will be erased. Active tickets and purchase history are kept anonymously for legal reasons. You will be signed out immediately.
            </p>
            <p className="mt-4 text-sm font-semibold text-gray-700">
              Type <span className="font-mono text-red-600">delete my account</span> to confirm:
            </p>
            <input
              type="text"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="delete my account"
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
            />
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => { setOpen(false); setConfirm(""); setError(""); }}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={confirm !== "delete my account" || loading}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? "Deleting…" : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
