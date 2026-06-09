import { db } from "@/lib/db";
import { format } from "date-fns";
import Link from "next/link";
import { NavUserSidebar } from "@/components/landing/NavUserSidebar";
import { Footer } from "@/components/layouts/Footer";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const events = await db.event.findMany({
    where: {
      status: "PUBLISHED",
      isPrivate: false,
      experienceType: "PUBLIC",
      OR: [
        { endDate: { gte: new Date() } },
        { endDate: null, date: { gte: new Date() } },
      ],
    },
    include: {
      ticketCategories: {
        where: { isComplimentary: false },
        select: { price: true, soldQuantity: true, totalQuantity: true, allowInstallments: true },
        orderBy: { price: "asc" },
      },
    },
    orderBy: { date: "asc" },
  });

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Nav */}
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-gray-100 bg-white/95 backdrop-blur-sm px-6 py-4 md:px-10">
        <Link href="/" className="flex items-center">
          <img src="/logo.svg" alt="Lumora" className="h-16 w-auto object-contain" />
        </Link>

        <NavUserSidebar />
      </nav>

      {/* Hero header */}
      <section className="relative overflow-hidden bg-gray-950 px-6 py-14 md:px-10 md:py-20">
        {/* Dot texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle, #16b5b8 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        {/* Teal glow */}
        <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[600px] -translate-x-1/2 rounded-full bg-primary-500/20 blur-[100px]" />

        <div className="relative mx-auto max-w-6xl">
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
            Upcoming experiences
          </h1>
          <p className="mt-3 text-base text-gray-400">
            Find your next experience — pay in full or spread the cost with installments.
          </p>
        </div>
      </section>

      {/* Grid */}
      <div className="mx-auto max-w-7xl px-6 py-10 md:px-10">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-24 text-center">
            <p className="text-lg font-bold text-gray-900">Nothing listed yet</p>
            <p className="mt-1 text-sm text-gray-500">Check back soon.</p>
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
                  {/* Cover image — 3:4 ratio */}
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
      </div>
      <Footer />
    </div>
  );
}
