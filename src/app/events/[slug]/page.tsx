import { notFound } from "next/navigation";
import { format } from "date-fns";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { PurchaseSection } from "./PurchaseSection";
import { NavUserSidebar } from "@/components/landing/NavUserSidebar";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await db.event.findUnique({ where: { slug } });
  return { title: event?.title ?? "Event" };
}

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();

  const event = await db.event.findUnique({
    where: { slug, status: "PUBLISHED" },
    include: {
      seller: { select: { name: true } },
      ticketCategories: {
        include: { installmentPlan: { include: { scheduleItems: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!event) notFound();

  const isSoldOut = event.ticketCategories.every(
    (c) => c.soldQuantity >= c.totalQuantity
  );

  const lowestPrice = event.ticketCategories.reduce(
    (min, c) => Math.min(min, Number(c.price)),
    Infinity
  );

  const dashboardHref = session?.user?.role === "SELLER" ? "/seller" : "/buyer";

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* ── Sticky nav ── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-gray-100 bg-white/95 backdrop-blur-sm px-6 py-4 md:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
            <span className="text-sm font-black text-white tracking-tight">L</span>
          </div>
          <span className="text-lg font-black tracking-tight text-gray-900">Lumora</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link href="/events" className="text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors">
            ← Explore
          </Link>
          {session?.user ? (
            <NavUserSidebar user={session.user} dashboardHref={dashboardHref} />
          ) : (
            <Link
              href="/login"
              className="rounded-xl bg-primary-600 px-5 py-2 text-sm font-bold tracking-wide text-white hover:bg-primary-700 transition-colors"
            >
              Log in
            </Link>
          )}
        </div>
      </nav>

      {/* ── Hero image ── */}
      <div className="relative h-72 w-full overflow-hidden sm:h-96 md:h-[440px]">
        {event.coverImage ? (
          <img
            src={event.coverImage}
            alt={event.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary-700 via-primary-600 to-cyan-500"
            style={{
              backgroundImage: "radial-gradient(circle at 30% 40%, rgba(255,255,255,0.08) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
        )}
        {/* Dark overlay — stronger at bottom for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />

        {/* Event info overlaid at bottom */}
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-8 md:px-10">
          <div className="mx-auto max-w-6xl">
            {isSoldOut && (
              <span className="mb-3 inline-flex rounded-full bg-red-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                Sold out
              </span>
            )}
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl md:text-5xl">
              {event.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-white/80">
              <span className="flex items-center gap-1.5">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {format(event.date, "EEEE, dd MMMM yyyy · HH:mm")}
                {event.endDate && ` — ${format(event.endDate, "HH:mm")}`}
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {event.venue}{event.city && `, ${event.city}`}
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Hosted by {event.seller.name}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="mx-auto max-w-6xl px-6 py-10 md:px-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">

          {/* Left — image + description */}
          <div className="space-y-6 lg:col-span-2">
            {/* Cover image thumbnail (shown only when we have one, as a proper preview) */}
            {event.coverImage && (
              <div className="overflow-hidden rounded-2xl border border-gray-100 shadow-sm">
                <img
                  src={event.coverImage}
                  alt={event.title}
                  className="w-full object-cover"
                  style={{ maxHeight: "340px" }}
                />
              </div>
            )}

            {/* About */}
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-black tracking-tight text-gray-900">About this experience</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-gray-600">
                {event.description}
              </p>
            </div>

            {/* Event details card */}
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-black tracking-tight text-gray-900">Details</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50">
                    <svg className="h-4 w-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Date & time</p>
                    <p className="mt-0.5 text-sm font-semibold text-gray-900">
                      {format(event.date, "EEEE, dd MMMM yyyy")}
                    </p>
                    <p className="text-sm text-gray-500">
                      {format(event.date, "HH:mm")}
                      {event.endDate && ` — ${format(event.endDate, "HH:mm")}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50">
                    <svg className="h-4 w-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Location</p>
                    <p className="mt-0.5 text-sm font-semibold text-gray-900">{event.venue}</p>
                    {event.city && <p className="text-sm text-gray-500">{event.city}</p>}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50">
                    <svg className="h-4 w-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Host</p>
                    <p className="mt-0.5 text-sm font-semibold text-gray-900">{event.seller.name}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right — sticky ticket panel */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 rounded-2xl border border-gray-100 bg-white shadow-md overflow-hidden">
              {/* Panel header */}
              <div className="bg-gradient-to-br from-primary-600 to-primary-700 px-6 py-5">
                <p className="text-xs font-bold uppercase tracking-widest text-primary-200">
                  {isSoldOut ? "Sold out" : "Secure your spot"}
                </p>
                {!isSoldOut && isFinite(lowestPrice) && (
                  <p className="mt-1 text-2xl font-black text-white">
                    From KES {lowestPrice.toLocaleString()}
                  </p>
                )}
                {!isSoldOut && (
                  <p className="mt-1 text-xs text-primary-200">
                    Select a ticket type below to continue
                  </p>
                )}
              </div>

              {/* Ticket selection */}
              <div className="p-5">
                <PurchaseSection
                  event={{
                    id: event.id,
                    date: event.date.toISOString(),
                    endDate: event.endDate?.toISOString() ?? null,
                  }}
                  categories={event.ticketCategories.map((c) => ({
                    id: c.id,
                    name: c.name,
                    description: c.description,
                    price: Number(c.price),
                    totalQuantity: c.totalQuantity,
                    soldQuantity: c.soldQuantity,
                    allowInstallments: c.allowInstallments,
                    installmentPlan: c.installmentPlan
                      ? {
                          initialPaymentPercent: Number(c.installmentPlan.initialPaymentPercent),
                          gracePeriodDays: c.installmentPlan.gracePeriodDays,
                          scheduleItems: c.installmentPlan.scheduleItems.map((s) => ({
                            installmentNumber: s.installmentNumber,
                            percentage: Number(s.percentage),
                            dueDate: s.dueDate.toISOString(),
                          })),
                        }
                      : null,
                  }))}
                  isLoggedIn={!!session?.user}
                />

                {/* Trust signals */}
                <div className="mt-4 flex items-center justify-center gap-4 border-t border-gray-100 pt-4">
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Secure checkout
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Powered by Paystack
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
