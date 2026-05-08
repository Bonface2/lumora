"use client";

import { useState } from "react";
import { createPlatformFeeTier, updatePlatformFeeTier } from "@/app/actions/platformFees";

interface Tier {
  id: string;
  label: string;
  maxCap: number | null;
  price: number;
  sortOrder: number;
  isActive: boolean;
}

interface RowState {
  label: string;
  maxCap: string;
  price: string;
  sortOrder: string;
  isActive: boolean;
}

function toRowState(t: Tier): RowState {
  return {
    label: t.label,
    maxCap: t.maxCap !== null ? String(t.maxCap) : "",
    price: String(t.price),
    sortOrder: String(t.sortOrder),
    isActive: t.isActive,
  };
}

function blankRow(): RowState {
  return { label: "", maxCap: "", price: "", sortOrder: "0", isActive: true };
}

export function TierManager({ tiers: initial }: { tiers: Tier[] }) {
  const [tiers, setTiers] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<RowState>(blankRow());
  const [addingNew, setAddingNew] = useState(false);
  const [newRow, setNewRow] = useState<RowState>(blankRow());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function startEdit(tier: Tier) {
    setEditing(tier.id);
    setDraft(toRowState(tier));
    setError("");
  }

  function cancelEdit() {
    setEditing(null);
    setError("");
  }

  async function saveEdit(id: string) {
    setSaving(true);
    setError("");
    const res = await updatePlatformFeeTier(id, {
      label: draft.label.trim(),
      maxCap: draft.maxCap === "" ? null : Number(draft.maxCap),
      price: Number(draft.price),
      sortOrder: Number(draft.sortOrder),
      isActive: draft.isActive,
    });
    setSaving(false);
    if (!res.ok) { setError(res.error); return; }
    setTiers((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              label: draft.label.trim(),
              maxCap: draft.maxCap === "" ? null : Number(draft.maxCap),
              price: Number(draft.price),
              sortOrder: Number(draft.sortOrder),
              isActive: draft.isActive,
            }
          : t
      )
    );
    setEditing(null);
  }

  async function saveNew() {
    setSaving(true);
    setError("");
    const res = await createPlatformFeeTier({
      label: newRow.label.trim(),
      maxCap: newRow.maxCap === "" ? null : Number(newRow.maxCap),
      price: Number(newRow.price),
      sortOrder: Number(newRow.sortOrder),
    });
    setSaving(false);
    if (!res.ok) { setError(res.error); return; }
    // Reload page to get the new id from DB
    window.location.reload();
  }

  const isEditRow = (id: string) => editing === id;

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left">
              <th className="px-5 py-3 font-semibold text-gray-600">Label</th>
              <th className="px-5 py-3 font-semibold text-gray-600">Max cap</th>
              <th className="px-5 py-3 font-semibold text-gray-600 text-right">Price (KES)</th>
              <th className="px-5 py-3 font-semibold text-gray-600 text-right">Sort</th>
              <th className="px-5 py-3 font-semibold text-gray-600 text-center">Active</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tiers.map((tier) =>
              isEditRow(tier.id) ? (
                <tr key={tier.id} className="bg-primary-50/40">
                  <td className="px-3 py-2">
                    <input
                      className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      value={draft.label}
                      onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                      placeholder="e.g. Starter"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      className="w-24 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      value={draft.maxCap}
                      onChange={(e) => setDraft((d) => ({ ...d, maxCap: e.target.value }))}
                      placeholder="Unlimited"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      className="w-28 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-right focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      value={draft.price}
                      onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      className="w-16 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-right focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      value={draft.sortOrder}
                      onChange={(e) => setDraft((d) => ({ ...d, sortOrder: e.target.value }))}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      checked={draft.isActive}
                      onChange={(e) => setDraft((d) => ({ ...d, isActive: e.target.checked }))}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => saveEdit(tier.id)}
                        disabled={saving}
                        className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
                      >
                        {saving ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={tier.id} className={`hover:bg-gray-50 transition-colors ${!tier.isActive ? "opacity-50" : ""}`}>
                  <td className="px-5 py-4 font-semibold text-gray-900">{tier.label}</td>
                  <td className="px-5 py-4 text-gray-600">
                    {tier.maxCap !== null ? tier.maxCap.toLocaleString() : <span className="text-gray-400">Unlimited</span>}
                  </td>
                  <td className="px-5 py-4 text-right font-semibold text-gray-900">
                    {tier.price.toLocaleString()}
                  </td>
                  <td className="px-5 py-4 text-right text-gray-500">{tier.sortOrder}</td>
                  <td className="px-5 py-4 text-center">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      tier.isActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {tier.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => startEdit(tier)}
                      className="text-sm font-semibold text-primary-600 hover:underline"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              )
            )}

            {/* New row form */}
            {addingNew && (
              <tr className="bg-emerald-50/40">
                <td className="px-3 py-2">
                  <input
                    className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    value={newRow.label}
                    onChange={(e) => setNewRow((r) => ({ ...r, label: e.target.value }))}
                    placeholder="e.g. Starter"
                    autoFocus
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={1}
                    className="w-24 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    value={newRow.maxCap}
                    onChange={(e) => setNewRow((r) => ({ ...r, maxCap: e.target.value }))}
                    placeholder="Unlimited"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    min={0}
                    className="w-28 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-right focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    value={newRow.price}
                    onChange={(e) => setNewRow((r) => ({ ...r, price: e.target.value }))}
                    placeholder="1000"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    min={0}
                    className="w-16 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-right focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    value={newRow.sortOrder}
                    onChange={(e) => setNewRow((r) => ({ ...r, sortOrder: e.target.value }))}
                  />
                </td>
                <td className="px-3 py-2 text-center text-gray-400 text-xs">Auto</td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={saveNew}
                      disabled={saving}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      {saving ? "Adding…" : "Add"}
                    </button>
                    <button
                      onClick={() => { setAddingNew(false); setNewRow(blankRow()); setError(""); }}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {tiers.length === 0 && !addingNew && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400">
                  No tiers configured. Add one below.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!addingNew && (
        <button
          onClick={() => { setAddingNew(true); setEditing(null); setError(""); }}
          className="flex items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-5 py-3 text-sm font-semibold text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors w-full justify-center"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add tier
        </button>
      )}
    </div>
  );
}
