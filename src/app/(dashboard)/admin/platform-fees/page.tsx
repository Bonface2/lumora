import { db } from "@/lib/db";
import { getPlatformConfig } from "@/lib/platformConfig";
import { TierManager } from "./TierManager";
import { TransactionFeeSettings } from "./TransactionFeeSettings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Platform fee tiers" };

export default async function PlatformFeesPage() {
  const [tiers, config] = await Promise.all([
    db.platformFeeTier.findMany({ orderBy: { sortOrder: "asc" } }),
    getPlatformConfig(),
  ]);

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
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <div className="mb-4">
            <h1 className="text-2xl font-black text-gray-900">Platform fees</h1>
            <p className="mt-1 text-sm text-gray-500">
              Configure transaction rates for paid and group trip events, and activation fee tiers for free events.
            </p>
          </div>

          <div className="mb-3">
            <h2 className="text-base font-bold text-gray-800">Transaction fee settings</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Applied per ticket purchase. Free events are not subject to transaction fees.
            </p>
          </div>
          <TransactionFeeSettings
            paidFeePercent={config.paidFeePercent}
            groupTripFlatFee={config.groupTripFlatFee}
            groupTripAutoApproveCap={config.groupTripAutoApproveCap}
          />
        </div>

        <div>
          <div className="mb-3">
            <h2 className="text-base font-bold text-gray-800">Free event activation tiers</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Sellers pick a tier when activating a free event; upgrading costs the difference.
            </p>
          </div>
          <TierManager tiers={serialized} />

          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <strong>Note:</strong> Changing a tier&apos;s price does not retroactively affect events that have already paid. Only new activations/upgrades use the updated prices.
          </div>
        </div>
      </div>
    </div>
  );
}
