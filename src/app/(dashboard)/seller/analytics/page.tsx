import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { format } from "date-fns";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { EventStatus } from "@prisma/client";

const statusVariant: Record<EventStatus, "default" | "success" | "danger" | "warning"> = {
  DRAFT: "default",
  PUBLISHED: "success",
  CANCELLED: "danger",
  COMPLETED: "warning",
};

export default async function AnalyticsPage() {
  const session = await auth();

  const events = await db.event.findMany({
    where: { sellerId: session!.user.id },
    include: {
      ticketCategories: {
        include: {
          orders: {
            where: { status: { notIn: ["PENDING", "CANCELLED", "REVOKED"] } },
            include: { payments: true },
          },
        },
      },
    },
    orderBy: { date: "asc" },
  });

  // Aggregate totals across all events
  let grandRevenue = 0;
  let grandCollected = 0;
  let grandSold = 0;

  const eventStats = events.map((event) => {
    let revenue = 0;
    let collected = 0;
    let sold = 0;
    let pendingInstallments = 0;

    for (const cat of event.ticketCategories) {
      sold += cat.soldQuantity;
      revenue += Number(cat.price) * cat.soldQuantity;

      for (const order of cat.orders) {
        collected += Number(order.paidAmount);
        for (const payment of order.payments) {
          if (payment.paymentNumber > 0 && payment.status === "PENDING") {
            pendingInstallments += Number(payment.amount);
          }
        }
      }
    }

    grandRevenue += revenue;
    grandCollected += collected;
    grandSold += sold;

    return { event, revenue, collected, sold, pendingInstallments };
  });

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">Revenue and sales across all your events.</p>
        </div>
        {events.length > 0 && (
          <div className="flex items-center gap-2">
            <a href="/api/seller/export?format=csv" download>
              <Button variant="ghost" size="sm">
                <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                CSV
              </Button>
            </a>
            <a href="/api/seller/export?format=xlsx" download>
              <Button variant="ghost" size="sm">
                <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Excel
              </Button>
            </a>
          </div>
        )}
      </div>

      {/* Grand totals */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        {[
          { label: "Total revenue", value: `KES ${grandRevenue.toLocaleString()}`, sub: "at full price" },
          { label: "Collected so far", value: `KES ${grandCollected.toLocaleString()}`, sub: "actual payments received" },
          { label: "Tickets sold", value: grandSold.toLocaleString(), sub: "across all events" },
        ].map((s) => (
          <Card key={s.label}>
            <CardBody>
              <p className="text-sm text-gray-500">{s.label}</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="mt-0.5 text-xs text-gray-400">{s.sub}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Per-event breakdown */}
      {eventStats.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-20 text-center">
          <p className="text-lg font-medium text-gray-900">No events yet</p>
          <a href="/seller/events/new" className="mt-3 text-sm text-violet-600 hover:underline">Create your first event →</a>
        </div>
      ) : (
        <div className="space-y-4">
          {eventStats.map(({ event, revenue, collected, sold, pendingInstallments }) => {
            const totalAvail = event.ticketCategories.reduce((s, c) => s + c.totalQuantity, 0);
            const collectionRate = revenue > 0 ? Math.round((collected / revenue) * 100) : 0;

            return (
              <Card key={event.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <a
                          href={`/seller/events/${event.id}`}
                          className="font-semibold text-gray-900 hover:text-violet-700"
                        >
                          {event.title}
                        </a>
                        <Badge variant={statusVariant[event.status]}>{event.status}</Badge>
                      </div>
                      <p className="text-sm text-gray-500">{format(event.date, "dd MMM yyyy · HH:mm")}</p>
                    </div>
                    <p className="text-lg font-bold text-gray-900">KES {revenue.toLocaleString()}</p>
                  </div>
                </CardHeader>
                <CardBody>
                  <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide">Sold</p>
                      <p className="mt-1 text-xl font-bold text-gray-900">{sold}</p>
                      <p className="text-xs text-gray-500">of {totalAvail} available</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide">Collected</p>
                      <p className="mt-1 text-xl font-bold text-gray-900">KES {collected.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">{collectionRate}% of expected</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide">Outstanding</p>
                      <p className="mt-1 text-xl font-bold text-amber-600">
                        KES {pendingInstallments.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">pending installments</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wide">Collection rate</p>
                      <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
                        <div
                          className="h-2 rounded-full bg-violet-500"
                          style={{ width: `${collectionRate}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{collectionRate}%</p>
                    </div>
                  </div>

                  {/* Per-category breakdown */}
                  {event.ticketCategories.length > 1 && (
                    <div className="mt-4 border-t border-gray-100 pt-4">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">By category</p>
                      <div className="space-y-1">
                        {event.ticketCategories.map((cat) => (
                          <div key={cat.id} className="flex items-center justify-between text-sm">
                            <span className="text-gray-700">{cat.name}</span>
                            <span className="text-gray-500">
                              {cat.soldQuantity} sold · KES {(Number(cat.price) * cat.soldQuantity).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
