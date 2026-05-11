"use client";

import { ReinstateButton } from "@/components/ReinstateButton";
import { sellerReinstateOrder } from "@/app/actions/events";
import { format } from "date-fns";
import { useState } from "react";

interface RevokedOrder {
  id: string;
  buyerName: string | null;
  buyerEmail: string;
  eventTitle: string;
  categoryName: string;
  paidAmount: number;
  totalAmount: number;
  revokedAt: Date;
  tickets: { ticketNumber: string }[];
}

export function RevokedOrdersTable({ orders }: { orders: RevokedOrder[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const visible = orders.filter((o) => !hidden.has(o.id));

  if (visible.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-400">
        No revoked tickets — all reinstated or none to show.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50 text-left">
            <th className="px-5 py-3 text-xs font-semibold text-gray-500">Buyer</th>
            <th className="px-5 py-3 text-xs font-semibold text-gray-500">Event / Category</th>
            <th className="px-5 py-3 text-xs font-semibold text-gray-500 text-right">Paid</th>
            <th className="px-5 py-3 text-xs font-semibold text-gray-500">Ticket(s)</th>
            <th className="px-5 py-3 text-xs font-semibold text-gray-500">Revoked</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {visible.map((o) => (
            <tr key={o.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-5 py-4">
                <p className="font-semibold text-gray-900">{o.buyerName ?? "—"}</p>
                <p className="text-xs text-gray-400">{o.buyerEmail}</p>
              </td>
              <td className="px-5 py-4">
                <p className="font-semibold text-gray-900 line-clamp-1">{o.eventTitle}</p>
                <p className="text-xs text-gray-400">{o.categoryName}</p>
              </td>
              <td className="px-5 py-4 text-right">
                <p className="font-semibold text-gray-900">KES {o.paidAmount.toLocaleString()}</p>
                {o.paidAmount < o.totalAmount && (
                  <p className="text-xs text-gray-400">of {o.totalAmount.toLocaleString()}</p>
                )}
              </td>
              <td className="px-5 py-4">
                {o.tickets.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {o.tickets.map((t) => (
                      <span key={t.ticketNumber} className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600">
                        {t.ticketNumber}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">—</span>
                )}
              </td>
              <td className="px-5 py-4 text-xs text-gray-500 whitespace-nowrap">
                {format(new Date(o.revokedAt), "dd MMM yyyy")}
              </td>
              <td className="px-5 py-4 text-right">
                <ReinstateButton
                  orderId={o.id}
                  buyerName={o.buyerName ?? o.buyerEmail}
                  action={sellerReinstateOrder}
                  onDone={() => setHidden((prev) => new Set(prev).add(o.id))}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
