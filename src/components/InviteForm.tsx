"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { sendEventInvites } from "@/app/actions/invites";

interface Invite {
  id: string;
  email: string;
  name: string | null;
  sentAt: Date | null;
}

interface Props {
  eventId: string;
  initialInvites: Invite[];
}

export function InviteForm({ eventId, initialInvites }: Props) {
  const [bulk, setBulk] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [invites, setInvites] = useState<Invite[]>(initialInvites);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const lines = bulk
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setError("Enter at least one email address.");
      return;
    }

    const parsed = lines.map((line) => {
      // Support "Name <email>" or plain "email"
      const match = line.match(/^(.+?)\s*<(.+?)>$/);
      if (match) return { name: match[1].trim(), email: match[2].trim() };
      return { email: line.trim() };
    });

    setLoading(true);
    const res = await sendEventInvites({ eventId, invites: parsed });
    setLoading(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }

    setSuccess(`${res.data.sent} invite${res.data.sent !== 1 ? "s" : ""} sent.`);
    setBulk("");

    // Optimistically add new invites to the list
    const now = new Date();
    setInvites((prev) => {
      const existing = new Set(prev.map((i) => i.email));
      const newOnes: Invite[] = parsed
        .filter((p) => !existing.has(p.email))
        .map((p) => ({ id: p.email, email: p.email, name: p.name ?? null, sentAt: now }));
      return [...newOnes, ...prev];
    });
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        {success && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p>
        )}

        <div>
          <Label required>Email addresses</Label>
          <textarea
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            rows={4}
            placeholder={"jane@example.com\njohn@example.com\nOr: Jane Doe <jane@example.com>"}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <p className="mt-1 text-xs text-gray-400">
            One per line, or comma-separated. Supports &quot;Name &lt;email&gt;&quot; format.
          </p>
        </div>

        <Button type="submit" loading={loading} size="sm">
          Send invites
        </Button>
      </form>

      {invites.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-400">
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Sent</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => (
                <tr key={inv.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{inv.email}</td>
                  <td className="px-4 py-2.5 text-gray-500">{inv.name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-400">
                    {inv.sentAt ? format(new Date(inv.sentAt), "dd MMM yyyy") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {invites.length === 0 && (
        <p className="py-4 text-center text-sm text-gray-400">No invites sent yet.</p>
      )}
    </div>
  );
}
