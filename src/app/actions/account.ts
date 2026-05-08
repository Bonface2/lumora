"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ApiResponse } from "@/types";

export async function updateProfile(data: {
  name: string;
  phone: string;
}): Promise<ApiResponse<null>> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Not authenticated." };

  await db.user.update({
    where: { id: session.user.id },
    data: {
      name: data.name.trim() || null,
      phone: data.phone.trim() || null,
    },
  });

  return { ok: true, data: null };
}

export async function deleteMyAccount(): Promise<ApiResponse<null>> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Not authenticated." };

  const id = session.user.id;

  await db.$transaction([
    // Anonymise the user record — we keep it for financial audit trail
    db.user.update({
      where: { id },
      data: {
        name: "Deleted User",
        email: `deleted_${id}@lumora.co`,
        phone: null,
        image: null,
        password: null,
        marketingEmails: false,
      },
    }),
    // Revoke all sessions so they're signed out immediately
    db.session.deleteMany({ where: { userId: id } }),
    // Remove OAuth account links
    db.account.deleteMany({ where: { userId: id } }),
  ]);

  return { ok: true, data: null };
}
