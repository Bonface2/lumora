"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import type { ApiResponse } from "@/types";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.email(),
  phone: z.string().min(7).optional(),
  password: z.string().min(8),
  role: z.enum(["BUYER", "SELLER"]),
});

export async function registerUser(
  input: unknown
): Promise<ApiResponse<{ id: string }>> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }

  const { name, email, phone, password, role } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "An account with this email already exists." };
  }

  const hashed = await bcrypt.hash(password, 12);

  const user = await db.user.create({
    data: { name, email, phone: phone ?? null, password: hashed, role },
  });

  return { ok: true, data: { id: user.id } };
}

export async function setPendingRoleCookie(role: "BUYER" | "SELLER") {
  const cookieStore = await cookies();
  cookieStore.set("pending_google_role", role, {
    httpOnly: true,
    path: "/",
    maxAge: 300, // 5 minutes — enough time to complete OAuth
    sameSite: "lax",
  });
}
