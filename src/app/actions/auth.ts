"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import type { ApiResponse } from "@/types";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.email(),
  phone: z.string().min(7),
  password: z.string().min(8),
  role: z.enum(["BUYER", "SELLER"]),
  ageConfirmed: z.boolean().optional(),
  marketingEmails: z.boolean().optional(),
});

export async function registerUser(
  input: unknown
): Promise<ApiResponse<{ id: string }>> {
  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  // 5 registrations per hour per IP
  const rl = await rateLimit(`register:${ip}`, 5, 3600);
  if (!rl.success) {
    return { ok: false, error: "Too many attempts. Please try again later." };
  }

  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }

  const { name, email, phone, password, role, ageConfirmed, marketingEmails } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "An account with this email already exists." };
  }

  const hashed = await bcrypt.hash(password, 12);

  const user = await db.user.create({
    data: { name, email, phone, password: hashed, role, ageConfirmed: ageConfirmed ?? false, marketingEmails: marketingEmails ?? false },
  });

  return { ok: true, data: { id: user.id } };
}

export async function checkLoginRateLimit(): Promise<ApiResponse<null>> {
  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  // 10 attempts per 15 minutes per IP
  const rl = await rateLimit(`login:${ip}`, 10, 900);
  if (!rl.success) {
    return { ok: false, error: "Too many login attempts. Please try again later." };
  }
  return { ok: true, data: null };
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
