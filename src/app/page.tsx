import { db } from "@/lib/db";
import Link from "next/link";
import { format } from "date-fns";
import { Footer } from "@/components/layouts/Footer";

export const revalidate = 60;

export default async function HomePage() {
  const events = await db.event.findMany({
    where: { status: "PUBLISHED", isPrivate: false, experienceType: "PUBLIC" },
    include: {
      ticketCategories: {
        where: { isComplimentary: false },
        select: { price: true, soldQuantity: true, totalQuantity: true, allowInstallments: true },
        orderBy: { price: "asc" },
      },
    },
    orderBy: { date: "asc" },
    take: 8,
  });

  return (
    <main className="min-h-screen bg-white font-sans">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-gray-100 bg-white/95 backdrop-blur-sm px-6 py-4 md:px-10">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <img src="/logo.svg" alt="Lumora" className="h-16 w-auto object-contain" />
        </Link>

        {/* Right: login button */}
        <Link
          href="/login"
          className="rounded-xl bg-primary-600 px-5 py-2 text-sm font-bold tracking-wide text-white hover:bg-primary-700 transition-colors"
        >
          Log in
        </Link>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gray-950 px-6 py-20 md:py-28 lg:py-32">
        {/* Dot texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle, #16b5b8 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        {/* Warm glow */}
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-primary-600/20 blur-[120px]" />

        <div className="relative mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary-700/40 bg-primary-900/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary-300 mb-8">
            Experiences · Tickets · Installments
          </span>
          <h1 className="text-5xl font-black leading-[1.08] tracking-tight text-white sm:text-6xl lg:text-7xl">
            Every experience{" "}
            <span className="text-primary-300">worth having.</span>
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-gray-400">
            Concerts, tours, group trips, retreats — buy tickets in full or
            spread the cost with installments. Secure payments via IntaSend.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/events"
              className="rounded-xl bg-primary-500 px-8 py-3.5 text-sm font-bold tracking-wide text-white shadow-lg shadow-primary-900/40 hover:bg-primary-400 transition-colors"
            >
              Explore Experiences
            </Link>
            <Link
              href="/register?role=seller"
              className="rounded-xl border border-white/20 bg-white/5 px-8 py-3.5 text-sm font-bold tracking-wide text-white backdrop-blur-sm hover:bg-white/10 transition-colors"
            >
              List yours ↗
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section className="border-b border-gray-100 bg-primary-50">
        <div className="mx-auto grid max-w-5xl grid-cols-1 divide-y divide-gray-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { icon: "💳", label: "Pay in installments", body: "Deposit now, spread the rest over time. Works for any experience — concerts to multi-day tours." },
            { icon: "🗺️", label: "Events, tours & more", body: "Concerts, group trips, retreats, day tours — one platform for any shared experience." },
            { icon: "🔒", label: "IntaSend secure", body: "Fast, trusted M-PESA and card payments — no third-party sign-up required." },
          ].map((f) => (
            <div key={f.label} className="flex items-start gap-4 px-8 py-8">
              <span className="text-2xl">{f.icon}</span>
              <div>
                <p className="font-bold text-gray-900">{f.label}</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-500">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Event grid ── */}
      <section className="mx-auto max-w-7xl px-6 py-16 md:px-10">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-gray-900">Upcoming experiences</h2>
            <p className="mt-1 text-sm text-gray-500">Curated experiences on Lumora</p>
          </div>
          <Link href="/events" className="text-sm font-semibold text-primary-600 hover:text-primary-700">
            View all →
          </Link>
        </div>

        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-24 text-center">
            <p className="text-lg font-bold text-gray-900">Nothing listed yet</p>
            <p className="mt-1 text-sm text-gray-500">Be the first to list an experience.</p>
            <Link href="/register?role=seller" className="mt-4 text-sm font-semibold text-primary-600 hover:underline">
              List yours →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {events.map((event) => {
              const lowestPrice = event.ticketCategories[0]?.price;
              const totalAvail = event.ticketCategories.reduce(
                (s, c) => s + (c.totalQuantity - c.soldQuantity),
                0
              );
              const soldOut = totalAvail === 0;
              const hasInstallments = event.ticketCategories.some((c) => c.allowInstallments);

              return (
                <Link
                  key={event.id}
                  href={`/events/${event.slug}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                >
                  {/* Cover image — 4:5 ratio */}
                  <div className="relative aspect-[4/5] w-full overflow-hidden bg-primary-100">
                    {event.coverImage ? (
                      <img
                        src={event.coverImage}
                        alt={event.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <svg className="h-10 w-10 text-primary-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}

                    {/* Date badge — top right */}
                    <div className="absolute right-2.5 top-2.5 flex flex-col items-center rounded-xl bg-white/95 px-2.5 py-1.5 shadow-md backdrop-blur-sm">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary-600 leading-none">
                        {format(event.date, "MMM")}
                      </span>
                      <span className="mt-0.5 text-lg font-black leading-none text-gray-900">
                        {format(event.date, "dd")}
                      </span>
                    </div>

                    {/* Installments badge — bottom left */}
                    {hasInstallments && (
                      <div className="absolute bottom-2.5 left-2.5">
                        <span className="rounded-full bg-primary-600/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                          Installments
                        </span>
                      </div>
                    )}

                    {/* Sold-out overlay */}
                    {soldOut && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-gray-900">
                          Sold out
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex flex-1 flex-col p-3.5">
                    <p className="line-clamp-2 text-sm font-bold leading-snug text-gray-900">
                      {event.title}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 truncate">
                      {event.venue}{event.city ? `, ${event.city}` : ""}
                    </p>
                    <div className="mt-auto pt-3">
                      {soldOut ? (
                        <span className="text-xs font-semibold text-gray-400">Sold out</span>
                      ) : (
                        <p className="text-sm font-bold text-primary-600">
                          <span className="text-xs font-normal text-gray-400">From </span>
                          KES {lowestPrice ? Number(lowestPrice).toLocaleString() : "—"}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Seller CTA ── */}
      <section className="bg-gray-950 px-6 py-20 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-primary-400 mb-4">
          For hosts &amp; organisers
        </p>
        <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
          Run your next experience on Lumora
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-base text-gray-400">
          Events, tours, group trips, retreats — set up tickets, configure
          installments, and get paid. All in one place.
        </p>
        <Link
          href="/register?role=seller"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary-500 px-8 py-3.5 text-sm font-bold tracking-wide text-white hover:bg-primary-400 transition-colors"
        >
          Get started for free
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>
      </section>

      <Footer />
    </main>
  );
}
