import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { format } from "date-fns";
import Link from "next/link";
import type { OrderStatus } from "@prisma/client";

const statusConfig: Record<OrderStatus, { label: string; cls: string }> = {
  PENDING: { label: "Pending", cls: "bg-gray-100 text-gray-600" },
  PARTIAL_PAID: { label: "Installments", cls: "bg-amber-100 text-amber-700" },
  PAID_IN_FULL: { label: "Paid in full", cls: "bg-emerald-100 text-emerald-700" },
  DEFAULTED: { label: "Defaulted", cls: "bg-red-100 text-red-600" },
  REVOKED: { label: "Revoked", cls: "bg-red-100 text-red-600" },
  CANCELLED: { label: "Cancelled", cls: "bg-gray-100 text-gray-500" },
};

/* Deterministic gradient for events without a cover image */
const gradients = [
  "from-primary-600 to-cyan-400",
  "from-violet-600 to-primary-400",
  "from-rose-500 to-orange-400",
  "from-indigo-600 to-primary-400",
  "from-emerald-500 to-cyan-400",
  "from-fuchsia-600 to-rose-400",
];

function eventGradient(id: string) {
  const idx = id.charCodeAt(0) % gradients.length;
  return gradients[idx];
}

export default async function BuyerTicketsPage() {
  const session = await auth();

  const orders = await db.order.findMany({
    where: {
      buyerId: session!.user.id,
      status: { notIn: ["PENDING", "CANCELLED"] },
    },
    include: {
      tickets: true,
      ticketCategory: { include: { event: true } },
      payments: { orderBy: { paymentNumber: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  const user = await db.user.findUnique({
    where: { id: session!.user.id },
    select: { name: true, email: true },
  });

  return (
    <div className="min-h-full bg-gray-50 font-sans">
      {/* ── Header ── */}
      <div className="relative overflow-hidden bg-gray-800 px-4 py-8 sm:px-8 sm:py-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle, #16b5b8 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="pointer-events-none absolute -top-24 left-1/3 h-64 w-96 rounded-full bg-primary-500/20 blur-[80px]" />

        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary-400 mb-1">
              Buyer dashboard
            </p>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">My Tickets</h1>
            <div className="mt-3 flex flex-wrap items-center gap-4 sm:gap-6">
              <div>
                <p className="text-2xl font-black text-white">{orders.length}</p>
                <p className="text-xs text-gray-500">ticket{orders.length !== 1 ? "s" : ""}</p>
              </div>
              {user?.name && (
                <>
                  <div className="h-8 w-px bg-white/10" />
                  <div>
                    <p className="text-sm font-semibold text-white">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          <Link
            href="/events"
            className="flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-sm font-bold text-white hover:bg-primary-500 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Browse events
          </Link>
        </div>
      </div>

      <div className="p-4 sm:p-6 md:p-8">

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100">
            <svg className="h-8 w-8 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
          </div>
          <p className="mt-4 text-lg font-bold text-gray-900">No tickets yet</p>
          <p className="mt-1 text-sm text-gray-500">Browse events and grab your first ticket.</p>
          <Link
            href="/events"
            className="mt-5 rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-primary-700 transition-colors"
          >
            Browse events
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map((order) => {
            const event = order.ticketCategory.event;
            const cfg = statusConfig[order.status];
            const paidAmount = Number(order.paidAmount);
            const totalAmount = Number(order.totalAmount);
            const progress = totalAmount > 0 ? Math.min(100, (paidAmount / totalAmount) * 100) : 0;
            const pendingPayments = order.payments.filter(
              (p) => p.paymentNumber > 0 && p.status === "PENDING"
            );
            const nextPayment = pendingPayments[0];

            return (
              <div
                key={order.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                {/* Cover / gradient header */}
                <div className="relative h-36 w-full overflow-hidden">
                  {event.coverImage ? (
                    <img
                      src={event.coverImage}
                      alt={event.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className={`h-full w-full bg-gradient-to-br ${eventGradient(event.id)}`} />
                  )}

                  {/* Dark gradient overlay for readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                  {/* Date badge */}
                  <div className="absolute right-3 top-3 flex flex-col items-center rounded-xl bg-white/95 px-2.5 py-1.5 shadow-md backdrop-blur-sm">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-primary-600 leading-none">
                      {format(event.date, "MMM")}
                    </span>
                    <span className="mt-0.5 text-base font-black leading-none text-gray-900">
                      {format(event.date, "dd")}
                    </span>
                  </div>

                  {/* Status badge — bottom left on image */}
                  <div className="absolute bottom-3 left-3">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${cfg.cls}`}>
                      {cfg.label}
                    </span>
                  </div>
                </div>

                {/* Body */}
                <div className="flex flex-1 flex-col p-4">
                  <h2 className="font-bold text-gray-900 leading-snug line-clamp-1">{event.title}</h2>
                  <p className="mt-0.5 text-xs text-gray-500 truncate">
                    {format(event.date, "HH:mm")} · {event.venue}{event.city ? `, ${event.city}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">{order.ticketCategory.name}</p>

                  {/* Ticket numbers */}
                  {order.tickets.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {order.tickets.map((t) => (
                        <span
                          key={t.id}
                          className="rounded-lg bg-primary-50 px-2.5 py-1 font-mono text-xs font-bold text-primary-700 border border-primary-100"
                        >
                          {t.ticketNumber}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Installment progress */}
                  {order.usesInstallments && (
                    <div className="mt-4 rounded-xl bg-gray-50 p-3">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                        <span className="font-medium">Payment progress</span>
                        <span className="font-bold text-gray-700">
                          KES {paidAmount.toLocaleString()} / {totalAmount.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-2 rounded-full bg-primary-500 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      {nextPayment && order.status === "PARTIAL_PAID" && (
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <div>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Next due</p>
                            <p className="text-sm font-bold text-gray-900">
                              KES {Number(nextPayment.amount).toLocaleString()}
                              <span className="ml-1 text-[10px] font-normal text-gray-500">
                                {format(nextPayment.dueDate, "dd MMM")}
                              </span>
                            </p>
                          </div>
                          <a
                            href={`/buyer/orders/${order.id}/pay`}
                            className="shrink-0 rounded-xl bg-primary-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-700 transition-colors"
                          >
                            Pay now
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
