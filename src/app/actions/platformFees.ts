"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ApiResponse } from "@/types";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
}

export async function createPlatformFeeTier(
  data: { label: string; maxCap?: number | null; price: number; sortOrder?: number }
): Promise<ApiResponse<void>> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized." };
  }

  if (data.price < 0) return { ok: false, error: "Price cannot be negative." };
  if (!data.label.trim()) return { ok: false, error: "Label is required." };

  await db.platformFeeTier.create({
    data: {
      label: data.label.trim(),
      maxCap: data.maxCap ?? null,
      price: data.price,
      sortOrder: data.sortOrder ?? 0,
    },
  });

  revalidatePath("/admin/platform-fees");
  return { ok: true, data: undefined };
}

export async function updatePlatformFeeTier(
  id: string,
  data: { label?: string; maxCap?: number | null; price?: number; sortOrder?: number; isActive?: boolean }
): Promise<ApiResponse<void>> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized." };
  }

  if (data.price !== undefined && data.price < 0) {
    return { ok: false, error: "Price cannot be negative." };
  }

  await db.platformFeeTier.update({
    where: { id },
    data: {
      ...(data.label !== undefined && { label: data.label }),
      ...(data.maxCap !== undefined && { maxCap: data.maxCap }),
      ...(data.price !== undefined && { price: data.price }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });

  revalidatePath("/admin/platform-fees");
  return { ok: true, data: undefined };
}
