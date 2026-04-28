import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { format } from "date-fns";
import Link from "next/link";

export default async function EventsPage() {
  const session = await auth();

  const events = await db.event.findMany({
    where: { status: "PUBLISHED" },
    include: {
      ticketCategories: {
        select: { price: true, soldQuantity: true, totalQuantity: true },
        orderBy: { price: "asc" },
      },
    },
    orderBy: { date: "asc" },
  });

  const dashboardHref = session?.user
    ? session.user.role === "SELLER"
      ? "/seller"
      : "/buyer"
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="flex items-center justify-between border-b border-gray-100 bg-white px-8 py-4">
        <Link href="/" className="text-xl font-bold text-violet-600">Lumora</Link>
        <div className="flex items-center gap-3">
          {dashboardHref ? (
            <Link
              href={dashboardHref}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
            >
              My dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </nav>

      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Upcoming Events</h1>

        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-20 text-center">
            <p className="text-lg font-medium text-gray-900">No events yet</p>
            <p className="mt-1 text-sm text-gray-500">Check back soon.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => {
              const lowestPrice = event.ticketCategories[0]?.price;
              const totalAvail = event.ticketCategories.reduce(
                (s, c) => s + (c.totalQuantity - c.soldQuantity),
                0
              );
              const soldOut = totalAvail === 0;

              return (
                <Link
                  key={event.id}
                  href={`/events/${event.slug}`}
                  className="flex items-center gap-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  {event.coverImage ? (
                    <img
                      src={event.coverImage}
                      alt={event.title}
                      className="h-20 w-20 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-violet-100">
                      <svg className="h-8 w-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-gray-900 truncate">{event.title}</h2>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {format(event.date, "EEE, dd MMM yyyy · HH:mm")}
                    </p>
                    <p className="text-sm text-gray-500">
                      {event.venue}{event.city ? `, ${event.city}` : ""}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    {soldOut ? (
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
                        Sold out
                      </span>
                    ) : (
                      <>
                        <p className="text-xs text-gray-400">From</p>
                        <p className="font-semibold text-violet-600">
                          KES {lowestPrice ? Number(lowestPrice).toLocaleString() : "—"}
                        </p>
                      </>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
