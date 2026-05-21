import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { UpgradePicker } from "./UpgradePicker";

export const metadata = { title: "Upgrade event tier" };

export default async function UpgradeEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [event, allTiers] = await Promise.all([
    db.event.findFirst({ where: { id, sellerId: session.user.id } }),
    db.platformFeeTier.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  if (!event) notFound();
  if (event.eventType !== "FREE") redirect(`/seller/events/${id}`);
  if (!event.platformFeePaid) redirect(`/seller/events/${id}/activate`);

  const alreadyPaid = Number(event.platformFeeAmount ?? 0);

  // Only show tiers that are an upgrade (higher price)
  const upgradeTiers = allTiers
    .filter((t) => t.price > alreadyPaid)
    .map((t) => ({
      id: t.id,
      label: t.label,
      maxCap: t.maxCap,
      price: t.price,
      upgradeCost: t.price - alreadyPaid,
    }));

  // Find current tier label from closest tier at or below alreadyPaid
  const currentTier = [...allTiers].reverse().find((t) => t.price <= alreadyPaid);
  const currentLabel = currentTier?.label ?? "Custom";
  const currentCap = event.attendeeCap;

  return (
    <div className="mx-auto max-w-lg p-8">
      <a href={`/seller/events/${id}`} className="mb-6 inline-flex items-center gap-1.5 text-sm text-primary-600 hover:underline">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to event
      </a>

      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-bold text-primary-700 ring-1 ring-primary-200">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
          Upgrade tier
        </div>

        <h1 className="mb-1 text-2xl font-black text-gray-900">Expand your event capacity</h1>
        <p className="mb-6 text-sm leading-relaxed text-gray-500">
          Your event has grown — upgrade to a higher tier to allow more registrations.
          You only pay the difference from your current tier.
        </p>

        <UpgradePicker
          eventId={id}
          currentLabel={currentLabel}
          currentCap={currentCap}
          upgradeTiers={upgradeTiers}
        />

        <p className="mt-4 text-xs text-gray-400">
          You will be redirected to IntaSend. Once payment is confirmed, your new capacity limit takes effect immediately.
        </p>
      </div>
    </div>
  );
}
