import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPlatformConfig } from "@/lib/platformConfig";
import { TierPicker } from "./TierPicker";
import { GroupTripActivation } from "./GroupTripActivation";

export const metadata = { title: "Activate event" };

export default async function ActivateEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;
  const justCreated = created === "1";
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [event, tiers, config] = await Promise.all([
    db.event.findFirst({ where: { id, sellerId: session.user.id } }),
    db.platformFeeTier.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    getPlatformConfig(),
  ]);

  if (!event) notFound();

  // Only FREE events and GROUP_TRIP events use this page
  if (event.eventType !== "FREE" && event.experienceType !== "GROUP_TRIP") {
    redirect(`/seller/events/${id}`);
  }

  // Already paid — nothing to do here
  if (event.platformFeePaid) redirect(`/seller/events/${id}`);

  const isGroupTrip = event.experienceType === "GROUP_TRIP";

  return (
    <div className="mx-auto max-w-lg p-8">
      <a href={`/seller/events/${id}`} className="mb-6 inline-flex items-center gap-1.5 text-sm text-primary-600 hover:underline">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to event
      </a>

      {justCreated && isGroupTrip && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <svg className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <div>
            <p className="font-semibold text-emerald-800 text-sm">Group trip created!</p>
            <p className="mt-0.5 text-xs text-emerald-700">
              One last step — pay the listing fee below to unlock publishing.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {isGroupTrip ? "Listing fee required" : "Activation required"}
        </div>

        <h1 className="mb-1 text-2xl font-black text-gray-900">
          {isGroupTrip ? "Pay your group trip listing fee" : "Activate your free experience"}
        </h1>
        <p className="mb-5 text-sm leading-relaxed text-gray-500">
          {isGroupTrip
            ? `A one-time listing fee of KES ${config.groupTripFlatFee.toLocaleString()} per participant is required before you can publish. This covers your declared group size of ${event.groupTripCapacity} people.`
            : "Choose how many attendees you're expecting. Your fee is based on capacity — you can always upgrade later if the event grows."}
        </p>

        {/* Event info */}
        <div className="mb-6 rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-1">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Event</p>
          <p className="font-semibold text-gray-900">{event.title}</p>
          <p className="text-sm text-gray-500">
            {format(event.date, "EEE, dd MMM yyyy · HH:mm")} · {event.venue}{event.city ? `, ${event.city}` : ""}
          </p>
        </div>

        {isGroupTrip ? (
          <GroupTripActivation
            eventId={id}
            capacity={event.groupTripCapacity ?? 0}
            flatFee={config.groupTripFlatFee}
          />
        ) : (
          <TierPicker
            eventId={id}
            tiers={tiers.map((t) => ({
              id: t.id,
              label: t.label,
              maxCap: t.maxCap,
              price: t.price,
            }))}
          />
        )}

        <p className="mt-4 text-xs text-gray-400">
          {isGroupTrip
            ? "You will be redirected to IntaSend to complete payment. Once confirmed, you can publish your group trip."
            : "You will be redirected to IntaSend to complete payment. Once confirmed, your event will be ready to publish. You can upgrade your tier at any time from your event dashboard."}
        </p>
      </div>
    </div>
  );
}
