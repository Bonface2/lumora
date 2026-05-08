import { db } from "@/lib/db";
import { TierManager } from "./TierManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Platform fee tiers" };

export default async function PlatformFeesPage() {
  const tiers = await db.platformFeeTier.findMany({
    orderBy: { sortOrder: "asc" },
  });

  const serialized = tiers.map((t) => ({
    id: t.id,
    label: t.label,
    maxCap: t.maxCap,
    price: t.price,
    sortOrder: t.sortOrder,
    isActive: t.isActive,
  }));

  return (
    <div className="min-h-full bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-gray-900">Platform fee tiers</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure the activation fee tiers for free public events. Sellers pick a tier when activating; upgrading costs the difference.
          </p>
        </div>

        <TierManager tiers={serialized} />

        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Note:</strong> Changing a tier&apos;s price does not retroactively affect events that have already paid. Only new activations/upgrades use the updated prices.
        </div>
      </div>
    </div>
  );
}
