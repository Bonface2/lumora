import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ActivateButton } from "./ActivateButton";

export const metadata = { title: "Activate free event" };

export default async function ActivateEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const event = await db.event.findFirst({
    where: { id, sellerId: session.user.id },
  });

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
        {/* Badge */}
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Activation required
        </div>

        <h1 className="mb-1 text-2xl font-black text-gray-900">Activate your free experience</h1>
        <p className="mb-6 text-sm leading-relaxed text-gray-500">
          To list a free experience on Lumora, a one-time platform fee applies. This helps us maintain the
          platform and prevents spam events.
        </p>

        {/* Event details */}
        <div className="mb-6 rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Event</p>
          <p className="font-semibold text-gray-900">{event.title}</p>
          <p className="text-sm text-gray-500">
            {format(event.date, "EEE, dd MMM yyyy · HH:mm")} · {event.venue}{event.city ? `, ${event.city}` : ""}
          </p>
        </div>

        {/* Fee callout */}
        <div className="mb-6 flex items-center justify-between rounded-xl border border-primary-200 bg-primary-50 px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary-500">One-time activation fee</p>
            <p className="mt-0.5 text-3xl font-black text-primary-700">KES 1,000</p>
          </div>
          <svg className="h-10 w-10 text-primary-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <p className="mb-5 text-xs text-gray-400">
          You will be redirected to Paystack to complete payment. Once confirmed, your event will be
          ready to publish.
        </p>

        <ActivateButton eventId={id} />
      </div>
    </div>
  );
}
