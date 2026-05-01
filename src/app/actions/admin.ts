"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ApiResponse } from "@/types";

export async function setEventPlatformFee(
  eventId: string,
  feePercent: number | null
): Promise<ApiResponse<null>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { ok: false, error: "Unauthorized." };
  }

  if (feePercent !== null && (feePercent < 0 || feePercent > 100)) {
    return { ok: false, error: "Fee must be between 0 and 100." };
  }

  await db.event.update({
    where: { id: eventId },
    data: { platformFeePercent: feePercent },
  });

  return { ok: true, data: null };
}

export async function getAdminEvent(eventId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;

  return db.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      date: true,
      venue: true,
      status: true,
      platformFeePercent: true,
      seller: { select: { name: true, email: true } },
    },
  });
}
