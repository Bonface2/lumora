"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { updateProfile, deleteMyAccount } from "@/app/actions/account";

interface Props {
  user: {
    name: string | null;
    email: string;
    phone: string | null;
    role: string;
    provider: "google" | "credentials";
    createdAt: Date;
  };
}

const ROLE_LABELS: Record<string, string> = {
  BUYER: "Buyer",
  SELLER: "Seller",
  ADMIN: "Admin",
};

const ROLE_COLORS: Record<string, string> = {
  BUYER: "bg-primary-50 text-primary-700",
  SELLER: "bg-violet-50 text-violet-700",
  ADMIN: "bg-red-50 text-red-700",
};

export function ProfileForm({ user }: Props) {
  const [name, setName] = useState(user.name ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const initials = name
    ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user.email[0].toUpperCase();

  async function handleSave() {
    setSaving(true);
    setSaveSuccess(false);
    setSaveError("");
    const res = await updateProfile({ name, phone });
    setSaving(false);
    if (!res.ok) { setSaveError(res.error); return; }
    setSaveSuccess(true);
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError("");
    const res = await deleteMyAccount();
    if (!res.ok) { setDeleteError(res.error); setDeleting(false); return; }
    await signOut({ callbackUrl: "/" });
  }

  return (
    <div className="space-y-6">
      {/* Avatar + identity */}
      <div className="flex items-center gap-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xl font-black text-primary-700">
          {initials}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-black text-gray-900">{name || "—"}</p>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${ROLE_COLORS[user.role] ?? "bg-gray-100 text-gray-600"}`}>
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
          </div>
          <p className="text-sm text-gray-500">{user.email}</p>
          <p className="mt-0.5 text-xs text-gray-400">
            Member since {new Date(user.createdAt).toLocaleDateString("en-KE", { month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* Edit details */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-5">
        <h2 className="font-bold text-gray-900">Personal details</h2>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">Full name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setSaveSuccess(false); }}
              placeholder="Your name"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">Phone number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setSaveSuccess(false); }}
              placeholder="+254 7XX XXX XXX"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">Email address</label>
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={user.email}
                disabled
                className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-2.5 text-sm text-gray-500 cursor-not-allowed"
              />
              <span
                title={user.provider === "google" ? "Signed in with Google" : "Email & password"}
                className="shrink-0 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs font-semibold text-gray-500"
              >
                {user.provider === "google" ? "Google" : "Email"}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-400">Email cannot be changed.</p>
          </div>
        </div>

        {saveError && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</p>
        )}
        {saveSuccess && (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            Profile updated successfully.
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-primary-700 transition-colors disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      {/* Danger zone */}
      <div className="rounded-2xl border border-red-100 bg-white p-6">
        <h2 className="font-bold text-red-800">Danger zone</h2>
        <p className="mt-1 text-sm text-gray-500">
          Permanently removes your personal data. Purchase history is anonymised and retained for
          legal compliance. This cannot be undone.
        </p>
        <button
          onClick={() => setDeleteOpen(true)}
          className="mt-4 rounded-xl border border-red-200 px-5 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
        >
          Delete my account
        </button>
      </div>

      {/* Delete confirmation modal */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-black text-gray-900">Are you absolutely sure?</h2>
            <p className="mt-2 text-sm text-gray-500">
              Your name, email, and phone will be erased. Active tickets and purchase history are
              kept anonymously for legal reasons. You will be signed out immediately.
            </p>
            <p className="mt-4 text-sm font-semibold text-gray-700">
              Type <span className="font-mono text-red-600">delete my account</span> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="delete my account"
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
            />
            {deleteError && <p className="mt-2 text-xs text-red-600">{deleteError}</p>}
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => { setDeleteOpen(false); setDeleteConfirm(""); setDeleteError(""); }}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirm !== "delete my account" || deleting}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleting ? "Deleting…" : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
