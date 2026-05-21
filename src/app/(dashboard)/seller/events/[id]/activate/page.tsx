import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { TierPicker } from "./TierPicker";

export const metadata = { title: "Activate free event" };

export default async function ActivateEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [event, tiers] = await Promise.all([
    db.event.findFirst({ where: { id, sellerId: session.user.id } }),
    db.platformFeeTier.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  if (!event) notFound();
  if (event.eventType !== "FREE") redirect(`/seller/events/${id}`);
  if (event.platformFeePaid) redirect(`/seller/events/${id}`);

  return (
    <div className="mx-auto max-w-lg p-8">
      <a href={`/seller/events/${id}`} className="mb-6 inline-flex items-center gap-1.5 text-sm text-primary-600 hover:underline">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to event
      </a>

      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Activation required
        </div>

        <h1 className="mb-1 text-2xl font-black text-gray-900">Activate your free experience</h1>
        <p className="mb-5 text-sm leading-relaxed text-gray-500">
          Choose how many attendees you&apos;re expecting. Your fee is based on capacity — you can always upgrade later if the event grows.
        </p>

        {/* Event info */}
        <div className="mb-6 rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-1">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Event</p>
          <p className="font-semibold text-gray-900">{event.title}</p>
          <p className="text-sm text-gray-500">
            {format(event.date, "EEE, dd MMM yyyy · HH:mm")} · {event.venue}{event.city ? `, ${event.city}` : ""}
          </p>
        </div>

        {/* Tier grid + pay button */}
        <TierPicker
          eventId={id}
          tiers={tiers.map((t) => ({
            id: t.id,
            label: t.label,
            maxCap: t.maxCap,
            price: t.price,
          }))}
        />

        <p className="mt-4 text-xs text-gray-400">
          You will be redirected to IntaSend to complete payment. Once confirmed, your event will be ready to publish.
          You can upgrade your tier at any time from your event dashboard.
        </p>
      </div>
    </div>
  );
}
