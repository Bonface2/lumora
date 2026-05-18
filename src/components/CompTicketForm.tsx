"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  addCompCategory,
  deleteCompCategory,
  generateCompTicket,
  topUpCompCategory,
} from "@/app/actions/complimentary";

interface CompCategory {
  id: string;
  name: string;
  totalQuantity: number;
  soldQuantity: number;
}

interface Props {
  eventId: string;
  initialCategories: CompCategory[];
}

const SUGGESTED = ["Complimentary", "Staff", "All Access", "Media", "VIP Guest", "Sponsor"];

export function CompTicketForm({ eventId, initialCategories }: Props) {
  const [categories, setCategories] = useState<CompCategory[]>(initialCategories);

  // Add category form
  const [catName, setCatName] = useState("");
  const [catQty, setCatQty] = useState("10");
  const [addingCat, setAddingCat] = useState(false);
  const [catError, setCatError] = useState("");

  // Top-up state: which category chip is expanded
  const [topUpId, setTopUpId] = useState<string | null>(null);
  const [topUpQty, setTopUpQty] = useState("5");
  const [toppingUp, setToppingUp] = useState(false);
  const [topUpError, setTopUpError] = useState("");

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Issue ticket form
  const [categoryId, setCategoryId] = useState(initialCategories[0]?.id ?? "");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [issueQty, setIssueQty] = useState("1");
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState("");
  const [issueSuccess, setIssueSuccess] = useState("");

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    setCatError("");
    setAddingCat(true);
    const res = await addCompCategory({ eventId, name: catName, quantity: Number(catQty) });
    setAddingCat(false);
    if (!res.ok) { setCatError(res.error); return; }
    setCategories((prev) => [...prev, res.data]);
    if (!categoryId) setCategoryId(res.data.id);
    setCatName("");
    setCatQty("10");
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const res = await deleteCompCategory({ eventId, categoryId: id });
    setDeletingId(null);
    if (!res.ok) { alert(res.error); return; }
    setCategories((prev) => prev.filter((c) => c.id !== id));
    if (categoryId === id) setCategoryId(categories.find((c) => c.id !== id)?.id ?? "");
  }

  async function handleTopUp(categoryId: string) {
    setTopUpError("");
    setToppingUp(true);
    const res = await topUpCompCategory({
      eventId,
      categoryId,
      additionalQuantity: Number(topUpQty),
    });
    setToppingUp(false);
    if (!res.ok) { setTopUpError(res.error); return; }
    setCategories((prev) =>
      prev.map((c) => c.id === categoryId ? { ...c, totalQuantity: res.data.totalQuantity } : c)
    );
    setTopUpId(null);
    setTopUpQty("5");
  }

  async function handleIssue(e: React.FormEvent) {
    e.preventDefault();
    setIssueError("");
    setIssueSuccess("");
    if (!categoryId) { setIssueError("Add a comp category first."); return; }
    const qty = Math.max(1, Number(issueQty));
    setIssuing(true);
    const res = await generateCompTicket({
      eventId,
      categoryId,
      recipientEmail,
      recipientName,
      quantity: qty,
    });
    setIssuing(false);
    if (!res.ok) { setIssueError(res.error); return; }

    const { ticketNumbers } = res.data;
    setIssueSuccess(
      ticketNumbers.length === 1
        ? `Ticket ${ticketNumbers[0]} sent to ${recipientEmail}`
        : `${ticketNumbers.length} tickets sent to ${recipientEmail}: ${ticketNumbers.join(", ")}`
    );
    setRecipientName("");
    setRecipientEmail("");
    setIssueQty("1");

    setCategories((prev) =>
      prev.map((c) =>
        c.id === categoryId ? { ...c, soldQuantity: c.soldQuantity + ticketNumbers.length } : c
      )
    );
  }

  return (
    <div className="space-y-8">

      {/* ── Section 1: Define comp categories ── */}
      <div>
        <h3 className="mb-3 text-sm font-bold text-gray-700">Comp categories</h3>

        {categories.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {categories.map((c) => (
              <div key={c.id} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                  <span className="text-sm font-semibold text-gray-800">{c.name}</span>
                  <span className="text-xs text-gray-400">{c.soldQuantity}/{c.totalQuantity}</span>
                  {c.soldQuantity >= c.totalQuantity && (
                    <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">Full</span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setTopUpId(topUpId === c.id ? null : c.id);
                      setTopUpError("");
                      setTopUpQty("5");
                    }}
                    className="ml-1 rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold text-gray-600 hover:bg-primary-100 hover:text-primary-700 transition-colors"
                  >
                    + more
                  </button>
                  {c.soldQuantity === 0 && (
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      disabled={deletingId === c.id}
                      title="Delete category"
                      className="ml-0.5 rounded-full p-0.5 text-gray-400 hover:bg-red-100 hover:text-red-600 disabled:opacity-40 transition-colors"
                    >
                      {deletingId === c.id ? (
                        <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                        </svg>
                      ) : (
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  )}

                </div>

                {/* Inline top-up form */}
                {topUpId === c.id && (
                  <div className="flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2">
                    <span className="text-xs text-primary-700 font-medium">Add</span>
                    <input
                      type="number"
                      min={1}
                      value={topUpQty}
                      onChange={(e) => setTopUpQty(e.target.value)}
                      className="w-16 rounded-lg border border-primary-300 bg-white px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary-500"
                      autoFocus
                    />
                    <span className="text-xs text-primary-700 font-medium">more</span>
                    <button
                      type="button"
                      onClick={() => handleTopUp(c.id)}
                      disabled={toppingUp}
                      className="rounded-lg bg-primary-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
                    >
                      {toppingUp ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTopUpId(null)}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Cancel
                    </button>
                    {topUpError && <span className="text-xs text-red-600">{topUpError}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAddCategory} className="space-y-3">
          {catError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{catError}</p>}

          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED.filter((s) => !categories.some((c) => c.name.toLowerCase() === s.toLowerCase())).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setCatName(s)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  catName === s
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-gray-200 text-gray-500 hover:border-primary-300 hover:text-primary-600"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label required>Category name</Label>
              <Input
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="e.g. Media, Sponsor"
                required
              />
            </div>
            <div className="w-28">
              <Label required>Quantity</Label>
              <Input
                type="number"
                min={1}
                value={catQty}
                onChange={(e) => setCatQty(e.target.value)}
                required
              />
            </div>
            <Button type="submit" loading={addingCat} variant="secondary" size="sm">
              Add
            </Button>
          </div>
        </form>
      </div>

      {/* ── Section 2: Issue a ticket ── */}
      <div>
        <h3 className="mb-3 text-sm font-bold text-gray-700">Issue a ticket</h3>

        {categories.length === 0 ? (
          <p className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-400">
            Add a comp category above before issuing tickets.
          </p>
        ) : (
          <form onSubmit={handleIssue} className="space-y-3">
            {issueError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{issueError}</p>}
            {issueSuccess && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{issueSuccess}</p>}

            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label required>Category</Label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id} disabled={c.soldQuantity >= c.totalQuantity}>
                      {c.name} — {c.totalQuantity - c.soldQuantity} remaining
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <Label required>Quantity</Label>
                <Input
                  type="number"
                  min={1}
                  value={issueQty}
                  onChange={(e) => setIssueQty(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label required>Recipient name</Label>
                <Input
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Jane Doe"
                  required
                />
              </div>
              <div>
                <Label required>Recipient email</Label>
                <Input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="jane@example.com"
                  required
                />
              </div>
            </div>

            <Button type="submit" loading={issuing} size="sm">
              Generate &amp; send {Number(issueQty) > 1 ? `${issueQty} tickets` : "ticket"}
            </Button>
          </form>
        )}
      </div>

    </div>
  );
}
