"use server";

import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ApiResponse } from "@/types";

export async function getMyPhone(): Promise<string | null> {
  const session = await auth();
  if (!session?.user) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { phone: true },
  });
  return user?.phone ?? null;
}

export async function updateMyPhone(phone: string): Promise<ApiResponse<null>> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Not authenticated." };

  const parsed = z
    .string()
    .regex(/^\+?[\d\s\-]{7,15}$/, "Enter a valid phone number.")
    .safeParse(phone.trim());

  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  await db.user.update({
    where: { id: session.user.id },
    data: { phone: parsed.data },
  });

  return { ok: true, data: null };
}
