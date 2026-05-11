import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { AnalyticsCharts } from "./AnalyticsCharts";
import { RevokedOrdersTable } from "./RevokedOrdersTable";
import { ExportModal } from "./ExportModal";
import { getPlatformConfig, computeSellerNet } from "@/lib/platformConfig";

function isOverdue(
  order: { status: string; payments: { paymentNumber: number; dueDate: Date; status: string }[] },
  now: Date
) {
  if (order.status === "DEFAULTED" || order.status === "REVOKED") return true;
  if (order.status !== "PARTIAL_PAID") return false;
  return order.payments.some(
    (p) => p.paymentNumber > 0 && p.dueDate < now && (p.status === "PENDING" || p.status === "OVERDUE" || p.status === "DEFAULTED")
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const session = await auth();
  const { event: selectedEventId } = await searchParams;
  const now = new Date();

  const [allEvents, platformConfig] = await Promise.all([
    db.event.findMany({
      where: { sellerId: session!.user.id },
      include: {
        ticketCategories: {
          include: {
            orders: {
              include: { payments: true },
            },
          },
        },
      },
      orderBy: { date: "asc" },
    }),
    getPlatformConfig(),
  ]);

  // Filter to selected event if specified, otherwise use all
  const events = selectedEventId
    ? allEvents.filter((e) => e.id === selectedEventId)
    : allEvents;

  let grandRevenue = 0;
  let grandCollected = 0;
  let grandSold = 0;
  let grandAvailable = 0;
  let grandNearingRevocation = 0;
  let grandRevoked = 0;
  let grandTotalOrders = 0;

  const eventStats: {
    name: string;
    revenue: number;
    collected: number;
    outstanding: number;
    sold: number;
    available: number;
  }[] = [];

  const categoryStats: {
    categoryId: string;
    name: string;
    eventName: string;
    sold: number;
    available: number;
    defaulted: number;
    revoked: number;
    totalOrders: number;
  }[] = [];

  for (const event of events) {
    let evRevenue = 0;
    let evCollected = 0;
    let evSold = 0;
    const evAvailable = event.ticketCategories.reduce((s, c) => s + c.totalQuantity, 0);

    for (const cat of event.ticketCategories) {
      evSold += cat.soldQuantity;
      evRevenue += Number(cat.price) * cat.soldQuantity;

      let catCollected = 0;
      let catDefaulted = 0;
      let catRevoked = 0;
      let catTotalOrders = 0;

      for (const order of cat.orders) {
        if (order.status === "PENDING" || order.status === "CANCELLED") continue;
        catTotalOrders++;
        catCollected += Number(order.paidAmount);
        if (isOverdue(order, now)) catDefaulted++;
        if (order.status === "REVOKED") catRevoked++;
      }

      evCollected += catCollected;
      grandNearingRevocation += cat.orders.filter((o) => isOverdue(o, now) && o.status !== "REVOKED").length;
      grandRevoked += catRevoked;
      grandTotalOrders += catTotalOrders;

      categoryStats.push({
        categoryId: cat.id,
        name: cat.name,
        eventName: event.title,
        sold: cat.soldQuantity,
        available: cat.totalQuantity,
        defaulted: catDefaulted,
        revoked: catRevoked,
        totalOrders: catTotalOrders,
      });
    }

    grandRevenue += evRevenue;
    grandCollected += evCollected;
    grandSold += evSold;
    grandAvailable += evAvailable;

    eventStats.push({
      name: event.title,
      revenue: evRevenue,
      collected: evCollected,
      outstanding: Math.max(0, evRevenue - evCollected),
      sold: evSold,
      available: evAvailable,
    });
  }

  const grandDefaulted = categoryStats.reduce((s, c) => s + c.defaulted, 0);
  const grandDefaultRate =
    grandTotalOrders > 0 ? Math.round((grandDefaulted / grandTotalOrders) * 100) : 0;

  // Disbursement metrics — always computed across all events (payouts are per-seller, not per-event)
  let sellerNetEarned = 0;
  let grossCollected = 0;
  for (const event of allEvents) {
    for (const cat of event.ticketCategories) {
      for (const order of cat.orders) {
        if (order.status === "PENDING" || order.status === "CANCELLED") continue;
        const paid = Number(order.paidAmount);
        grossCollected += paid;
        const { sellerNet } = computeSellerNet(
          paid,
          event.eventType,
          event.experienceType,
          event.platformFeePercent,
          platformConfig
        );
        sellerNetEarned += sellerNet;
      }
    }
  }
  sellerNetEarned = Math.round(sellerNetEarned * 100) / 100;
  grossCollected = Math.round(grossCollected * 100) / 100;
  const platformFeeTotal = Math.round((grossCollected - sellerNetEarned) * 100) / 100;

  const payouts = await db.payout.findMany({
    where: { sellerId: session!.user.id },
    include: {
      payoutMethod: {
        select: { paystackBankName: true, bankType: true, paystackAccountNumber: true, label: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const MOBILE_TYPES = new Set(["mobile_money", "mobile_money_business"]);
  const totalDisbursed = Math.round(payouts.filter((p) => p.status === "success").reduce((s, p) => s + Number(p.amount), 0) * 100) / 100;
  const pendingDisbursement = Math.round(payouts.filter((p) => p.status === "pending").reduce((s, p) => s + Number(p.amount), 0) * 100) / 100;
  const outstandingBalance = Math.max(0, Math.round((sellerNetEarned - totalDisbursed - pendingDisbursement) * 100) / 100);

  /* RESALE:
  const sellerEventIds = events.map((e) => e.id);
  const resaleActive =
    sellerEventIds.length === 0
      ? 0
      : await db.resaleListing.count({
          where: {
            status: "ACTIVE",
            ticket: {
              order: {
                ticketCategory: { eventId: { in: sellerEventIds } },
              },
            },
          },
        });
  */

  // Revoked orders scoped to this seller's events (filtered by event selection)
  const revokedOrders = await db.order.findMany({
    where: {
      status: "REVOKED",
      ticketCategory: {
        event: {
          sellerId: session!.user.id,
          ...(selectedEventId ? { id: selectedEventId } : {}),
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      paidAmount: true,
      totalAmount: true,
      updatedAt: true,
      buyer: { select: { name: true, email: true } },
      ticketCategory: { select: { name: true, event: { select: { title: true } } } },
      tickets: { select: { ticketNumber: true } },
    },
  });

  const selectedEvent = selectedEventId
    ? allEvents.find((e) => e.id === selectedEventId)
    : null;

  return (
    <div className="min-h-full bg-gray-50 font-sans">
      {/* ── Header ── */}
      <div className="relative overflow-hidden bg-gray-800 px-8 py-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle, #16b5b8 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="pointer-events-none absolute -top-24 left-1/3 h-64 w-96 rounded-full bg-primary-500/20 blur-[80px]" />

        <div className="relative flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary-400 mb-1">
              Seller dashboard
            </p>
            <h1 className="text-3xl font-black tracking-tight text-white">Analytics</h1>
            <p className="mt-1 text-sm text-gray-400">
              {selectedEvent
                ? `Showing data for: ${selectedEvent.title}`
                : "Revenue and sales across all your events."}
            </p>
          </div>

          {allEvents.length > 0 && (
            <ExportModal events={allEvents.map((e) => ({ id: e.id, title: e.title }))} />
          )}
        </div>

        {/* ── Event filter pills ── */}
        {allEvents.length > 1 && (
          <div className="relative mt-5 flex flex-wrap gap-2">
            <Link
              href="/seller/analytics"
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                !selectedEventId
                  ? "bg-primary-500 text-white"
                  : "bg-white/10 text-gray-300 hover:bg-white/20"
              }`}
            >
              All events
            </Link>
            {allEvents.map((e) => (
              <Link
                key={e.id}
                href={`/seller/analytics?event=${e.id}`}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors truncate max-w-[200px] ${
                  selectedEventId === e.id
                    ? "bg-primary-500 text-white"
                    : "bg-white/10 text-gray-300 hover:bg-white/20"
                }`}
              >
                {e.title}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Charts ── */}
      <div className="p-8">
        {allEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50">
              <svg className="h-8 w-8 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="mt-4 text-lg font-bold text-gray-900">No data yet</p>
            <p className="mt-1 text-sm text-gray-500">Create and publish events to see your analytics.</p>
            <a href="/seller/events/new" className="mt-5">
              <button className="rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-primary-700 transition-colors">
                Create your first event
              </button>
            </a>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-24 text-center">
            <p className="text-lg font-bold text-gray-900">No data for this event</p>
            <p className="mt-1 text-sm text-gray-500">No orders have been placed for this event yet.</p>
          </div>
        ) : (
          <AnalyticsCharts
            eventStats={eventStats}
            grandRevenue={grandRevenue}
            grandCollected={grandCollected}
            grandSold={grandSold}
            grandAvailable={grandAvailable}
            categoryStats={categoryStats}
            grandDefaultRate={grandDefaultRate}
            grandNearingRevocation={grandNearingRevocation}
            grandRevoked={grandRevoked}
          />
        )}
      </div>

      {/* ── Disbursements ── */}
      {sellerNetEarned > 0 && (
        <div className="px-8 pb-12">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">Disbursements</h2>
          <p className="mb-4 text-xs text-gray-400">Across all your events, after platform fee.</p>

          {/* KPI cards */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Gross collected", value: `KES ${grossCollected.toLocaleString()}`, sub: "total payments received", color: "text-gray-900" },
              { label: "Platform fee", value: `KES ${platformFeeTotal.toLocaleString()}`, sub: "deducted by Lumora", color: "text-primary-600" },
              { label: "Net earned", value: `KES ${sellerNetEarned.toLocaleString()}`, sub: "after platform fee", color: "text-gray-900" },
              { label: "Awaiting payout", value: `KES ${outstandingBalance.toLocaleString()}`, sub: pendingDisbursement > 0 ? `+ KES ${pendingDisbursement.toLocaleString()} pending` : totalDisbursed > 0 ? `KES ${totalDisbursed.toLocaleString()} disbursed` : "not yet disbursed", color: outstandingBalance > 0 ? "text-amber-500" : "text-emerald-600" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{s.label}</p>
                <p className={`mt-2 text-2xl font-black ${s.color}`}>{s.value}</p>
                <p className="mt-0.5 text-xs text-gray-400">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Transactions table */}
          {payouts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center">
              <p className="text-sm font-semibold text-gray-500">No disbursements yet.</p>
              <p className="mt-1 text-xs text-gray-400">Payments will appear here once Lumora processes your first payout.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left">
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500">Date</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500">Account</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 text-right">Amount</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {payouts.map((p) => {
                    const isMobile = p.payoutMethod ? MOBILE_TYPES.has(p.payoutMethod.bankType) : false;
                    const accountStr = p.payoutMethod
                      ? `${p.payoutMethod.paystackBankName}${p.payoutMethod.label ? ` · ${p.payoutMethod.label}` : ""} — ${isMobile ? p.payoutMethod.paystackAccountNumber : `****${p.payoutMethod.paystackAccountNumber.slice(-4)}`}`
                      : "—";
                    return (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">
                          {p.createdAt.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="px-5 py-3.5 text-gray-600 max-w-[220px] truncate">{accountStr}</td>
                        <td className="px-5 py-3.5 text-right font-semibold text-gray-900 whitespace-nowrap">
                          KES {Number(p.amount).toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5">
                          {p.status === "success" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Paid
                            </span>
                          ) : p.status === "pending" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                              Pending
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                              Failed
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Revoked tickets ── */}
      <div className="px-8 pb-12">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Revoked tickets</h2>
            <p className="mt-0.5 text-xs text-gray-400">
              Tickets revoked due to missed payments or manual action.
              You can reinstate a ticket if a dispute is resolved.
            </p>
          </div>
          {revokedOrders.length > 0 && (
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
              {revokedOrders.length}
            </span>
          )}
        </div>

        {revokedOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center">
            <p className="text-sm font-semibold text-gray-500">No revoked tickets.</p>
          </div>
        ) : (
          <RevokedOrdersTable
            orders={revokedOrders.map((o) => ({
              id: o.id,
              buyerName: o.buyer.name,
              buyerEmail: o.buyer.email,
              eventTitle: o.ticketCategory.event.title,
              categoryName: o.ticketCategory.name,
              paidAmount: Number(o.paidAmount),
              totalAmount: Number(o.totalAmount),
              revokedAt: o.updatedAt,
              tickets: o.tickets,
            }))}
          />
        )}
      </div>
    </div>
  );
}
