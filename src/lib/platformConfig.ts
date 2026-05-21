import { db } from "./db";
import type { Decimal } from "@prisma/client/runtime/library";

export type PlatformConfigData = {
  paidFeePercent: number;
  groupTripFlatFee: number;
  groupTripAutoApproveCap: number;
  convenienceFee: number;        // flat KES per paid checkout transaction
  installmentFeePercent: number; // % of total ticket price charged when using installments
  installmentFeeCap: number;     // maximum KES charged regardless of percentage
  transferFee: number;           // flat KES charged to recipient on ticket transfer
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
    groupTripAutoApproveCap: config.groupTripAutoApproveCap,
    convenienceFee: Number(config.convenienceFee),
    installmentFeePercent: Number(config.installmentFeePercent),
    installmentFeeCap: Number(config.installmentFeeCap),
    transferFee: Number(config.transferFee),
  };
}

export function computeSellerNet(
  grossAmount: number,
  eventType: string,
  experienceType: string,
  platformFeePercent: Decimal | number | null,
  config: PlatformConfigData,
): { sellerNet: number; platformFee: number; feeLabel: string } {
  // FREE events: no transaction cut — they paid an activation fee upfront
  if (eventType === "FREE") {
    return { sellerNet: grossAmount, platformFee: 0, feeLabel: "Activation fee" };
  }

  // GROUP_TRIP: listing fee paid upfront — no per-ticket deduction
  if (experienceType === "GROUP_TRIP") {
    return { sellerNet: grossAmount, platformFee: 0, feeLabel: "Listing fee (paid upfront)" };
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
