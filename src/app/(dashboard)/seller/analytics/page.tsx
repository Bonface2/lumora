import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AnalyticsCharts } from "./AnalyticsCharts";

export default async function AnalyticsPage() {
  const session = await auth();

  const events = await db.event.findMany({
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
  });

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
        if (order.status === "DEFAULTED") catDefaulted++;
        if (order.status === "REVOKED") { catDefaulted++; catRevoked++; }
      }

      evCollected += catCollected;
      grandNearingRevocation += cat.orders.filter((o) => o.status === "DEFAULTED").length;
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
            <p className="mt-1 text-sm text-gray-400">Revenue and sales across all your events.</p>
          </div>

          {events.length > 0 && (
            <div className="flex items-center gap-2">
              <a href="/api/seller/export?format=csv" download>
                <button className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-300 hover:bg-white/10 transition-colors">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  CSV
                </button>
              </a>
              <a href="/api/seller/export?format=xlsx" download>
                <button className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-300 hover:bg-white/10 transition-colors">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Excel
                </button>
              </a>
            </div>
          )}
        </div>
      </div>

      {/* ── Charts ── */}
      <div className="p-8">
        {events.length === 0 ? (
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
            resaleActive={resaleActive}
          />
        )}
      </div>
    </div>
  );
}
