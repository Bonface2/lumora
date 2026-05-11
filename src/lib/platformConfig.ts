import { db } from "./db";
import type { Decimal } from "@prisma/client/runtime/library";

export type PlatformConfigData = {
  paidFeePercent: number;
  groupTripFlatFee: number;
};

export async function getPlatformConfig(): Promise<PlatformConfigData> {
  let config;
  try {
    config = await db.platformConfig.upsert({
      where: { id: "singleton" },
      create: { id: "singleton" },
      update: {},
    });
  } catch (e: unknown) {
    // Two concurrent requests both tried to INSERT — retry as a read
    if ((e as { code?: string })?.code === "P2002") {
      config = await db.platformConfig.findUniqueOrThrow({ where: { id: "singleton" } });
    } else {
      throw e;
    }
  }
  return {
    paidFeePercent: Number(config.paidFeePercent),
    groupTripFlatFee: Number(config.groupTripFlatFee),
  };
}

export function computeSellerNet(
  grossAmount: number,
  eventType: string,
  experienceType: string,
  platformFeePercent: Decimal | number | null,
  config: PlatformConfigData,
  platformFlatFee?: Decimal | number | null,
): { sellerNet: number; platformFee: number; feeLabel: string } {
  // FREE events: no transaction cut — they paid an activation fee upfront
  if (eventType === "FREE") {
    return { sellerNet: grossAmount, platformFee: 0, feeLabel: "Activation fee" };
  }

  // GROUP_TRIP: flat fee per registration (per-event override takes priority)
  if (experienceType === "GROUP_TRIP") {
    const fee = platformFlatFee != null ? Number(platformFlatFee) : config.groupTripFlatFee;
    const platformFee = Math.min(fee, grossAmount);
    const isCustom = platformFlatFee != null;
    return {
      sellerNet: grossAmount - platformFee,
      platformFee,
      feeLabel: `KES ${fee.toLocaleString()} flat${isCustom ? " (custom)" : ""}`,
    };
  }

  // PAID (PUBLIC / INVITE_ONLY): percentage-based
  const feePercent =
    platformFeePercent !== null
      ? Number(platformFeePercent)
      : config.paidFeePercent;
  const platformFee = grossAmount * (feePercent / 100);
  return {
    sellerNet: grossAmount - platformFee,
    platformFee,
    feeLabel:
      platformFeePercent !== null
        ? `${feePercent}% (custom)`
        : `${feePercent}% (default)`,
  };
}
