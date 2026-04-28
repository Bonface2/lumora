import { notFound } from "next/navigation";
import { format } from "date-fns";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/Badge";
import { PurchaseSection } from "./PurchaseSection";

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-br from-violet-700 to-violet-900 text-white">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <div className="flex items-center gap-2 mb-4">
            <a href="/" className="text-violet-200 hover:text-white text-sm">Lumora</a>
            <span className="text-violet-400">/</span>
            <span className="text-sm text-violet-200">Events</span>
          </div>
          <h1 className="text-3xl font-bold sm:text-4xl">{event.title}</h1>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-violet-200">
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {format(event.date, "EEEE, dd MMMM yyyy")}
              {event.endDate && ` — ${format(event.endDate, "dd MMMM yyyy")}`}
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {event.venue}{event.city && `, ${event.city}`}
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Organised by {event.seller.name}
            </span>
          </div>
          {isSoldOut && (
            <div className="mt-4">
              <Badge variant="danger" className="text-sm px-3 py-1">Sold Out</Badge>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Left — description */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl bg-white border border-gray-200 p-6">
              <h2 className="mb-3 font-semibold text-gray-900">About this event</h2>
              <p className="whitespace-pre-line text-sm text-gray-700 leading-relaxed">
                {event.description}
              </p>
            </div>
          </div>

          {/* Right — ticket categories */}
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-900">Tickets</h2>
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
                      initialPaymentPercent: Number(
                        c.installmentPlan.initialPaymentPercent
                      ),
                      gracePeriodDays: c.installmentPlan.gracePeriodDays,
                      scheduleItems: c.installmentPlan.scheduleItems.map(
                        (s) => ({
                          installmentNumber: s.installmentNumber,
                          percentage: Number(s.percentage),
                          dueDate: s.dueDate.toISOString(),
                        })
                      ),
                    }
                  : null,
              }))}
              isLoggedIn={!!session?.user}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
