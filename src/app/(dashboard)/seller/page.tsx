import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { format } from "date-fns";
import Link from "next/link";
import type { EventStatus } from "@prisma/client";

const statusConfig: Record<EventStatus, { label: string; cls: string }> = {
  DRAFT:          { label: "Draft",          cls: "bg-gray-100 text-gray-600" },
  PUBLISHED:      { label: "Published",      cls: "bg-emerald-100 text-emerald-700" },
  CANCELLED:      { label: "Cancelled",      cls: "bg-red-100 text-red-600" },
  COMPLETED:      { label: "Completed",      cls: "bg-primary-100 text-primary-700" },
  PENDING_REVIEW: { label: "Pending review", cls: "bg-amber-100 text-amber-700" },
};

const gradients = [
  "from-primary-700 to-cyan-500",
  "from-violet-700 to-primary-500",
  "from-rose-600 to-orange-400",
  "from-indigo-700 to-primary-500",
  "from-emerald-600 to-cyan-400",
];

function eventGradient(id: string) {
  return gradients[id.charCodeAt(0) % gradients.length];
}

export default async function SellerEventsPage() {
  const session = await auth();
  const events = await db.event.findMany({
    where: { sellerId: session!.user.id },
    include: {
      ticketCategories: {
        select: { soldQuantity: true, totalQuantity: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const totalSoldAll = events.reduce(
    (s, e) => s + e.ticketCategories.reduce((a, c) => a + c.soldQuantity, 0), 0
  );
  const totalAvailAll = events.reduce(
    (s, e) => s + e.ticketCategories.reduce((a, c) => a + c.totalQuantity, 0), 0
  );

  const payoutMethodCount = await db.payoutMethod.count({
    where: { sellerId: session!.user.id },
  });

  return (
    <div className="min-h-full bg-gray-50 font-sans">
      {/* ── Vibrant header ── */}
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
              Seller dashboard
            </p>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">My Experiences</h1>
            <div className="mt-3 flex flex-wrap items-center gap-4 sm:gap-6">
              <div>
                <p className="text-2xl font-black text-white">{events.length}</p>
                <p className="text-xs text-gray-500">experiences</p>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div>
                <p className="text-2xl font-black text-white">{totalSoldAll}</p>
                <p className="text-xs text-gray-500">tickets sold</p>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div>
                <p className="text-2xl font-black text-white">{totalAvailAll - totalSoldAll}</p>
                <p className="text-xs text-gray-500">remaining</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {events.length > 0 && (
              <>
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
              </>
            )}
            <a href="/seller/events/new">
              <button className="flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-sm font-bold text-white hover:bg-primary-500 transition-colors">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New experience
              </button>
            </a>
          </div>
        </div>
      </div>

      {/* ── KYC / payout method notice ── */}
      {payoutMethodCount === 0 && (
        <div className="mx-4 mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 sm:mx-6 md:mx-8">
          <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800">Add a payout method to receive earnings</p>
            <p className="mt-0.5 text-sm text-amber-700">
              Add a bank account or M-PESA number in Settings so your earnings can be paid out after your event.
            </p>
          </div>
          <Link
            href="/seller/settings"
            className="shrink-0 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600 transition-colors"
          >
            Go to Settings
          </Link>
        </div>
      )}

      {/* ── Grid ── */}
      <div className="p-4 sm:p-6 md:p-8">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50">
              <svg className="h-8 w-8 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="mt-4 text-lg font-bold text-gray-900">Nothing listed yet</p>
            <p className="mt-1 text-sm text-gray-500">List your first experience to start selling tickets.</p>
            <a href="/seller/events/new" className="mt-5">
              <button className="rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-primary-700 transition-colors">
                List your first experience
              </button>
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => {
              const totalSold = event.ticketCategories.reduce((s, c) => s + c.soldQuantity, 0);
              const totalAvail = event.ticketCategories.reduce((s, c) => s + c.totalQuantity, 0);
              const cfg = statusConfig[event.status];
              const pct = totalAvail > 0 ? Math.round((totalSold / totalAvail) * 100) : 0;

              return (
                <div
                  key={event.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  {/* Cover image / gradient */}
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
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                    {/* Status + privacy badges */}
                    <div className="absolute left-3 bottom-3 flex items-center gap-1.5">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${cfg.cls}`}>
                        {cfg.label}
                      </span>
                      {event.isPrivate && (
                        <span className="rounded-full bg-gray-900/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                          Private
                        </span>
                      )}
                    </div>

                    {/* Date badge */}
                    <div className="absolute right-3 top-3 flex flex-col items-center rounded-xl bg-white/95 px-2.5 py-1.5 shadow-md backdrop-blur-sm">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-primary-600 leading-none">
                        {format(event.date, "MMM")}
                      </span>
                      <span className="mt-0.5 text-base font-black leading-none text-gray-900">
                        {format(event.date, "dd")}
                      </span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex flex-1 flex-col p-4">
                    <h2 className="font-bold text-gray-900 leading-snug line-clamp-1">{event.title}</h2>
                    <p className="mt-0.5 text-xs text-gray-500 truncate">{event.venue}{event.city ? `, ${event.city}` : ""}</p>

                    {/* Ticket progress */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>{totalSold} / {totalAvail} sold</span>
                        <span className="font-semibold text-gray-700">{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-1.5 rounded-full bg-primary-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-4 flex items-center gap-2">
                      <Link
                        href={`/seller/events/${event.id}`}
                        className="flex-1 rounded-xl bg-primary-600 py-2 text-center text-xs font-bold text-white hover:bg-primary-700 transition-colors"
                      >
                        View
                      </Link>
                      <Link
                        href={`/seller/events/${event.id}/edit`}
                        className="flex-1 rounded-xl border border-gray-200 py-2 text-center text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Edit
                      </Link>
                    </div>
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
