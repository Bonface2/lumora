"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { adminGetUser, adminGetUserOrders, adminUpdateUserRole, adminDeleteUser } from "@/app/actions/admin";

type UserData = Awaited<ReturnType<typeof adminGetUser>>;
type UserOrders = Awaited<ReturnType<typeof adminGetUserOrders>>;

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-50 text-red-700",
  SELLER: "bg-primary-50 text-primary-700",
  BUYER: "bg-gray-100 text-gray-600",
};

const STATUS_COLORS: Record<string, string> = {
  PAID_IN_FULL: "bg-emerald-50 text-emerald-700",
  PARTIAL_PAID: "bg-amber-50 text-amber-700",
  PENDING: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-50 text-red-600",
  DEFAULTED: "bg-orange-50 text-orange-700",
  REVOKED: "bg-red-50 text-red-700",
};

function formatStatus(s: string) {
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<UserData>(null);
  const [orders, setOrders] = useState<UserOrders>([]);
  const [selectedRole, setSelectedRole] = useState<"BUYER" | "SELLER" | "ADMIN">("BUYER");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    Promise.all([adminGetUser(id), adminGetUserOrders(id)]).then(([u, o]) => {
      setUser(u);
      setOrders(o);
      if (u) setSelectedRole(u.role as "BUYER" | "SELLER" | "ADMIN");
    });
  }, [id]);

  async function handleDelete() {
    if (!confirm(`Permanently delete ${user?.name ?? user?.email}? This cannot be undone.`)) return;
    setDeleting(true);
    setDeleteError("");
    const res = await adminDeleteUser(id);
    setDeleting(false);
    if (!res.ok) {
      setDeleteError(res.error);
      return;
    }
    window.location.href = "/admin/users";
  }

  async function handleSave() {
    setError("");
    setSuccess(false);
    setSaving(true);
    const res = await adminUpdateUserRole(id, selectedRole);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSuccess(true);
    setUser((prev) => prev ? { ...prev, role: selectedRole } : prev);
  }

  if (!user) {
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  const initials = user.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user.email[0].toUpperCase();

  return (
    <div className="min-h-full bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <a href="/admin/users" className="text-sm text-primary-600 hover:underline">
            ← All users
          </a>
        </div>

        {/* User card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-100 text-base font-black text-primary-700">
              {initials}
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900">{user.name ?? "—"}</h1>
              <p className="text-sm text-gray-500">{user.email}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Joined {new Date(user.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="rounded-xl bg-gray-50 px-4 py-3">
              <p className="text-xs text-gray-500">Orders</p>
              <p className="text-xl font-black text-gray-900">{user._count.orders}</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-4 py-3">
              <p className="text-xs text-gray-500">Events hosted</p>
              <p className="text-xl font-black text-gray-900">{user._count.events}</p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-700">Role</label>
            <div className="flex gap-2">
              {(["BUYER", "SELLER", "ADMIN"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => { setSelectedRole(r); setSuccess(false); setError(""); }}
                  className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                    selectedRole === r
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {r.charAt(0) + r.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
            )}
            {success && (
              <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                Role updated successfully.
              </p>
            )}

            <Button
              onClick={handleSave}
              loading={saving}
              disabled={selectedRole === user.role}
              className="w-full"
            >
              Save role
            </Button>
          </div>
        </div>

        {/* Danger zone */}
        <div className="rounded-2xl border border-red-200 bg-white p-6">
          <h2 className="text-base font-black text-red-700 mb-1">Danger zone</h2>
          <p className="text-sm text-gray-500 mb-4">
            Permanently delete this account. Only possible if the user has no orders or events.
          </p>
          {deleteError && (
            <p className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{deleteError}</p>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete user"}
          </button>
        </div>

        {/* Recent orders */}
        {orders.length > 0 && (
          <div>
            <h2 className="mb-3 text-base font-black text-gray-900">Recent orders</h2>
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left">
                    <th className="px-5 py-3 font-semibold text-gray-600">Event</th>
                    <th className="px-5 py-3 font-semibold text-gray-600">Status</th>
                    <th className="px-5 py-3 font-semibold text-gray-600 text-right">Amount</th>
                    <th className="px-5 py-3 font-semibold text-gray-600">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-gray-900 line-clamp-1">{o.ticketCategory.event.title}</p>
                        <p className="text-xs text-gray-400">{o.ticketCategory.name}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[o.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {formatStatus(o.status)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-900">
                        KES {Number(o.totalAmount).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-gray-500">
                        {new Date(o.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
