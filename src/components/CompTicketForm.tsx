"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { addCompCategory, generateCompTicket } from "@/app/actions/complimentary";

interface CompCategory {
  id: string;
  name: string;
  totalQuantity: number;
  soldQuantity: number;
}

interface CompOrder {
  id: string;
  buyer: { name: string | null; email: string };
  ticketCategory: { name: string };
  tickets: { ticketNumber: string }[];
  createdAt: Date;
}

interface Props {
  eventId: string;
  initialCategories: CompCategory[];
  initialOrders: CompOrder[];
}

const SUGGESTED = ["Complimentary", "Staff", "All Access", "Media", "VIP Guest", "Sponsor"];

export function CompTicketForm({ eventId, initialCategories, initialOrders }: Props) {
  const [categories, setCategories] = useState<CompCategory[]>(initialCategories);
  const [orders, setOrders] = useState<CompOrder[]>(initialOrders);

  // Add category form
  const [catName, setCatName] = useState("");
  const [catQty, setCatQty] = useState("10");
  const [addingCat, setAddingCat] = useState(false);
  const [catError, setCatError] = useState("");

  // Issue ticket form
  const [categoryId, setCategoryId] = useState(initialCategories[0]?.id ?? "");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
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

  async function handleIssue(e: React.FormEvent) {
    e.preventDefault();
    setIssueError("");
    setIssueSuccess("");
    if (!categoryId) { setIssueError("Add a comp category first."); return; }
    setIssuing(true);
    const res = await generateCompTicket({ eventId, categoryId, recipientEmail, recipientName });
    setIssuing(false);
    if (!res.ok) { setIssueError(res.error); return; }

    setIssueSuccess(`Ticket ${res.data.ticketNumber} sent to ${recipientEmail}`);
    setRecipientName("");
    setRecipientEmail("");

    setCategories((prev) =>
      prev.map((c) => c.id === categoryId ? { ...c, soldQuantity: c.soldQuantity + 1 } : c)
    );
    setOrders((prev) => [{
      id: res.data.ticketNumber,
      buyer: { name: recipientName, email: recipientEmail },
      ticketCategory: { name: categories.find((c) => c.id === categoryId)?.name ?? "" },
      tickets: [{ ticketNumber: res.data.ticketNumber }],
      createdAt: new Date(),
    }, ...prev]);
  }

  return (
    <div className="space-y-8">

      {/* ── Section 1: Define comp categories ── */}
      <div>
        <h3 className="mb-3 text-sm font-bold text-gray-700">Comp categories</h3>

        {categories.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                <span className="text-sm font-semibold text-gray-800">{c.name}</span>
                <span className="text-xs text-gray-400">{c.soldQuantity}/{c.totalQuantity}</span>
                {c.soldQuantity >= c.totalQuantity && (
                  <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">Full</span>
                )}
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAddCategory} className="space-y-3">
          {catError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{catError}</p>}

          {/* Quick-pick suggestions */}
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

            <div>
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
              Generate &amp; send ticket
            </Button>
          </form>
        )}
      </div>

      {/* ── Section 3: Issued tickets log ── */}
      {orders.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-bold text-gray-700">Issued tickets</h3>
          <div className="overflow-hidden rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-400">
                  <th className="px-4 py-2">Recipient</th>
                  <th className="px-4 py-2">Category</th>
                  <th className="px-4 py-2">Ticket #</th>
                  <th className="px-4 py-2">Sent</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-gray-900">{o.buyer.name || "—"}</p>
                      <p className="text-xs text-gray-400">{o.buyer.email}</p>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{o.ticketCategory.name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-600">
                      {o.tickets[0]?.ticketNumber ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">
                      {new Date(o.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
