import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PublishButton } from "./PublishButton";
import { CompTicketForm } from "@/components/CompTicketForm";
import { InviteForm } from "@/components/InviteForm";
import { createScanToken } from "@/lib/scanToken";
import type { EventStatus } from "@prisma/client";

const statusConfig: Record<EventStatus, { label: string; cls: string }> = {
  DRAFT:     { label: "Draft",     cls: "bg-gray-700 text-gray-300" },
  PUBLISHED: { label: "Published", cls: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" },
  CANCELLED: { label: "Cancelled", cls: "bg-red-500/20 text-red-400 border border-red-500/30" },
  COMPLETED: { label: "Completed", cls: "bg-primary-500/20 text-primary-400 border border-primary-500/30" },
};

export default async function SellerEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [event, compOrders, invites, allTiers] = await Promise.all([
    db.event.findFirst({
      where: { id, sellerId: session.user.id },
      include: {
        ticketCategories: {
          include: { installmentPlan: { include: { scheduleItems: true } } },
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
    db.order.findMany({
      where: { ticketCategory: { eventId: id, isComplimentary: true } },
      include: {
        buyer: { select: { name: true, email: true } },
        ticketCategory: { select: { name: true } },
        tickets: { select: { ticketNumber: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.eventInvite.findMany({
      where: { eventId: id },
      orderBy: { createdAt: "desc" },
    }),
    db.platformFeeTier.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  if (!event) notFound();

  const paidCategories = event.ticketCategories.filter((c) => !c.isComplimentary);
  const totalSold = paidCategories.reduce((s, c) => s + c.soldQuantity, 0);
  const totalAvail = paidCategories.reduce((s, c) => s + c.totalQuantity, 0);

  // Tier info for free events
  const alreadyPaid = Number(event.platformFeeAmount ?? 0);
  const currentTier = [...allTiers].reverse().find((t) => t.price <= alreadyPaid);
  const nextTier = allTiers.find((t) => t.price > alreadyPaid) ?? null;
  const capUsagePct = event.attendeeCap ? Math.round((totalSold / event.attendeeCap) * 100) : 0;
  const nearCap = event.attendeeCap !== null && capUsagePct >= 80;

  // Generate a time-limited scan link for invite-only events (expires at event end, or 6h after start)
  const scanLinkExpiry = event.endDate ?? new Date(event.date.getTime() + 6 * 60 * 60 * 1000);
  const scanToken = event.experienceType === "INVITE_ONLY"
    ? createScanToken(event.id, scanLinkExpiry)
    : null;
  const scanLinkExpired = scanToken !== null && Date.now() > scanLinkExpiry.getTime();
  const totalRevenue = paidCategories.reduce(
    (s, c) => s + Number(c.price) * c.soldQuantity, 0
  );
  const salesPct = totalAvail > 0 ? Math.round((totalSold / totalAvail) * 100) : 0;
  const cfg = statusConfig[event.status];

  return (
    <div className="min-h-full bg-gray-50 font-sans">
      {/* ── Hero header ── */}
      <div className="relative overflow-hidden bg-gray-800">
        {event.coverImage && (
          <img
            src={event.coverImage}
            alt={event.title}
            className="absolute inset-0 h-full w-full object-cover opacity-10"
          />
        )}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle, #16b5b8 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="pointer-events-none absolute -top-24 right-1/4 h-64 w-96 rounded-full bg-primary-500/20 blur-[80px]" />

        <div className="relative px-8 pt-6 pb-8">
          <a
            href="/seller"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to events
          </a>

          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            {/* Title block */}
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-black tracking-tight text-white">{event.title}</h1>
                <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${cfg.cls}`}>
                  {cfg.label}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-400">
                <span className="flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {format(event.date, "EEE, dd MMM yyyy · HH:mm")}
                  {event.endDate && ` — ${format(event.endDate, "HH:mm")}`}
                </span>
                <span className="text-gray-600">·</span>
                <span className="flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {event.venue}{event.city ? `, ${event.city}` : ""}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {event.status === "PUBLISHED" && (
                <a href={`/events/${event.slug}`} target="_blank">
                  <button className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-300 hover:bg-white/10 transition-colors">
                    Public page
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </button>
                </a>
              )}
              {/* Scan tickets — PUBLIC: staff login page; INVITE_ONLY: time-limited token link */}
              {event.status === "PUBLISHED" && event.experienceType === "PUBLIC" && (
                <a href={`/validate/${id}`} target="_blank">
                  <button className="flex items-center gap-1.5 rounded-xl border border-primary-500/40 bg-primary-500/10 px-3 py-2 text-xs font-semibold text-primary-300 hover:bg-primary-500/20 transition-colors">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    Scan tickets
                  </button>
                </a>
              )}
              {event.experienceType === "INVITE_ONLY" && scanToken && !scanLinkExpired && (
                <a href={`/scan/${scanToken}`} target="_blank">
                  <button className="flex items-center gap-1.5 rounded-xl border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-300 hover:bg-blue-500/20 transition-colors">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    Scan link
                  </button>
                </a>
              )}
              {totalSold > 0 && (
                <>
                  <a href={`/api/seller/events/${id}/export?format=csv`} download>
                    <button className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-300 hover:bg-white/10 transition-colors">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      CSV
                    </button>
                  </a>
                  <a href={`/api/seller/events/${id}/export?format=xlsx`} download>
                    <button className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-300 hover:bg-white/10 transition-colors">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Excel
                    </button>
                  </a>
                </>
              )}
              <a href={`/seller/events/${id}/edit`}>
                <button className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-300 hover:bg-white/10 transition-colors">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
              </a>
              {(event.status === "DRAFT" || event.status === "PUBLISHED") && (
                event.eventType === "FREE" && event.experienceType === "PUBLIC" && !event.platformFeePaid ? (
                  <a href={`/seller/events/${id}/activate`}>
                    <button className="flex items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-400/20 transition-colors">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Activate (KES 1,000)
                    </button>
                  </a>
                ) : (
                  <PublishButton eventId={id} status={event.status} />
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Body: 2-column layout ── */}
      <div className="grid grid-cols-1 gap-6 p-8 lg:grid-cols-3">

        {/* ── Left: Ticket categories / Participant spots ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Attendee nudge for large invite-only events */}
          {event.experienceType === "INVITE_ONLY" && totalAvail > 100 && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              <span className="font-semibold">Large event notice:</span> You have over 100 attendee spots. For events this size, contact us to arrange dedicated check-in support.
            </div>
          )}

          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">
            {event.experienceType === "GROUP_TRIP" ? "Participant spots" : "Ticket categories"}
          </h2>

          {paidCategories.map((cat) => {
            const catPct = cat.totalQuantity > 0
              ? Math.round((cat.soldQuantity / cat.totalQuantity) * 100)
              : 0;
            const isSoldOut = cat.soldQuantity >= cat.totalQuantity;

            return (
              <div key={cat.id} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="p-5">
                  {/* Top row: name + price */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-black text-gray-900">{cat.name}</h3>
                        {cat.allowInstallments && (
                          <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-700">
                            Installments
                          </span>
                        )}
                        {isSoldOut && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600">
                            Sold out
                          </span>
                        )}
                      </div>
                      {cat.description && (
                        <p className="mt-0.5 text-xs text-gray-400">{cat.description}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-black text-gray-900">KES {Number(cat.price).toLocaleString()}</p>
                      <p className="text-xs text-gray-400">{cat.soldQuantity} / {cat.totalQuantity} sold</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center justify-between text-[11px] text-gray-400">
                      <span>{catPct}% sold</span>
                      <span>{cat.totalQuantity - cat.soldQuantity} remaining</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-2 rounded-full bg-primary-500 transition-all"
                        style={{ width: `${catPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Installment plan footer */}
                {cat.installmentPlan && (
                  <div className="border-t border-primary-100 bg-primary-50 px-5 py-4 space-y-3">
                    {/* Plan meta — 3-col grid */}
                    <div className="grid grid-cols-3 divide-x divide-primary-200">
                      <div className="pr-4">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-primary-400">Initial payment</p>
                        <p className="mt-0.5 text-sm font-black text-primary-800">{Number(cat.installmentPlan.initialPaymentPercent)}%</p>
                      </div>
                      <div className="px-4">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-primary-400">Grace period</p>
                        <p className="mt-0.5 text-sm font-black text-primary-800">{cat.installmentPlan.gracePeriodDays} days</p>
                      </div>
                      <div className="pl-4">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-primary-400">Resale cutoff</p>
                        <p className="mt-0.5 text-sm font-black text-primary-800">3 days before</p>
                      </div>
                    </div>

                    {/* Schedule pills */}
                    {cat.installmentPlan.scheduleItems.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-primary-400">Schedule</p>
                        <div className="flex flex-wrap gap-2">
                          {cat.installmentPlan.scheduleItems.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-2 rounded-xl bg-white border border-primary-200 px-3 py-1.5"
                            >
                              <span className="text-[10px] font-bold text-primary-400">#{item.installmentNumber}</span>
                              <span className="h-3 w-px bg-primary-200" />
                              <span className="text-xs font-black text-primary-800">{Number(item.percentage)}%</span>
                              <span className="h-3 w-px bg-primary-200" />
                              <span className="text-[11px] font-semibold text-primary-600">{format(item.dueDate, "dd MMM yyyy")}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Right: Stats + About ── */}
        <div className="space-y-4">
          {/* KPI cards */}
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Overview</h2>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: event.experienceType === "GROUP_TRIP" ? "Bookings" : "Tickets sold", value: totalSold, sub: `of ${totalAvail}`, color: "text-gray-900" },
              { label: "Revenue",       value: `KES ${totalRevenue.toLocaleString()}`, sub: "at full price", color: "text-primary-600" },
              { label: "Remaining",     value: totalAvail - totalSold,       sub: "still available",     color: "text-gray-900" },
              { label: "Sales rate",    value: `${salesPct}%`,               sub: "of capacity",         color: salesPct >= 80 ? "text-emerald-600" : "text-amber-500" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{s.label}</p>
                <p className={`mt-1.5 text-xl font-black leading-none ${s.color}`}>{s.value}</p>
                <p className="mt-1 text-[11px] text-gray-400">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Free event tier status */}
          {event.eventType === "FREE" && event.platformFeePaid && event.attendeeCap !== null && (
            <div className={`rounded-2xl border p-4 shadow-sm ${nearCap ? "border-amber-200 bg-amber-50" : "border-gray-100 bg-white"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Tier</p>
                  <p className="mt-0.5 font-black text-gray-900">
                    {currentTier?.label ?? "Custom"}
                    <span className="ml-1.5 text-xs font-normal text-gray-400">
                      — up to {event.attendeeCap} spots
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {totalSold} of {event.attendeeCap} registered ({capUsagePct}%)
                  </p>
                </div>
                {nextTier && (
                  <a href={`/seller/events/${id}/upgrade`}>
                    <button className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                      nearCap
                        ? "bg-amber-500 text-white hover:bg-amber-600"
                        : "border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100"
                    }`}>
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                      Upgrade
                    </button>
                  </a>
                )}
              </div>
              {nearCap && nextTier && (
                <p className="mt-2 text-xs text-amber-700">
                  You&apos;re at {capUsagePct}% capacity. Upgrade to {nextTier.label} (up to {nextTier.maxCap ?? "unlimited"} spots) to keep accepting registrations.
                </p>
              )}
            </div>
          )}

          {/* Overall progress */}
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-700">Overall progress</span>
              <span className="font-bold text-gray-900">{salesPct}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-3 rounded-full bg-primary-500 transition-all"
                style={{ width: `${salesPct}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-gray-400">{totalSold} of {totalAvail} tickets sold</p>
          </div>

          {/* Scan link card for invite-only events */}
          {event.experienceType === "INVITE_ONLY" && scanToken && (
            <div>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">Your scan link</h2>
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 shadow-sm">
                {scanLinkExpired ? (
                  <p className="text-sm font-semibold text-blue-700">This scan link has expired (event has ended).</p>
                ) : (
                  <>
                    <p className="mb-2 text-xs text-blue-700">
                      Open this link on your phone on the day to scan tickets. It expires at event end.
                    </p>
                    <a
                      href={`/scan/${scanToken}`}
                      target="_blank"
                      className="block truncate rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-mono text-blue-800 hover:bg-blue-100 transition-colors"
                    >
                      {process.env.NEXTAUTH_URL ?? ""}/scan/{scanToken.slice(0, 32)}…
                    </a>
                  </>
                )}
              </div>
            </div>
          )}

          {/* About */}
          <div>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">About</h2>
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="whitespace-pre-line text-xs leading-relaxed text-gray-600">{event.description}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Complimentary tickets ── */}
      <div className="px-8 pb-8">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-400">Complimentary tickets</h2>
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <p className="mb-4 text-sm text-gray-500">
            Generate free tickets for specific recipients. They will receive the ticket QR code by email.
          </p>
          <CompTicketForm
            eventId={id}
            initialCategories={event.ticketCategories
              .filter((c) => c.isComplimentary)
              .map((c) => ({ id: c.id, name: c.name, totalQuantity: c.totalQuantity, soldQuantity: c.soldQuantity }))}
            initialOrders={compOrders}
          />
        </div>
      </div>

      {/* ── Invite guests (private events only) ── */}
      {event.isPrivate && (
        <div className="px-8 pb-8">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-400">Invite guests</h2>
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <p className="mb-4 text-sm text-gray-500">
              This is a private event. Send personalised email invitations with the direct event link.
            </p>
            <InviteForm eventId={id} initialInvites={invites} />
          </div>
        </div>
      )}
    </div>
  );
}
