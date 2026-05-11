"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import type { ApiResponse } from "@/types";
import { randomBytes } from "crypto";
import { addHours } from "date-fns";

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

export async function requestPasswordReset(
  email: string
): Promise<ApiResponse<null>> {
  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  // 3 requests per hour per IP
  const rl = await rateLimit(`pwd-reset:${ip}`, 3, 3600);
  if (!rl.success) {
    return { ok: false, error: "Too many attempts. Please try again later." };
  }

  const normalized = email.trim().toLowerCase();
  const user = await db.user.findUnique({
    where: { email: normalized },
    select: { id: true, name: true, password: true },
  });

  // Always return ok to prevent email enumeration
  if (!user || !user.password) return { ok: true, data: null };

  // Invalidate any existing unused tokens for this user
  await db.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { expiresAt: new Date() },
  });

  const rawToken = randomBytes(32).toString("hex");
  const expiresAt = addHours(new Date(), 1);

  await db.passwordResetToken.create({
    data: { token: rawToken, userId: user.id, expiresAt },
  });

  try {
    const { sendPasswordResetEmail } = await import("@/lib/email");
    await sendPasswordResetEmail({
      to: normalized,
      name: user.name ?? "there",
      resetUrl: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${rawToken}`,
    });
  } catch (err) {
    console.error("[auth] password reset email threw:", err);
  }

  return { ok: true, data: null };
}

export async function resetPassword(
  token: string,
  newPassword: string
): Promise<ApiResponse<null>> {
  if (!token || newPassword.length < 8) {
    return { ok: false, error: "Invalid request." };
  }

  const record = await db.passwordResetToken.findUnique({
    where: { token },
    include: { user: { select: { id: true } } },
  });

  if (!record) return { ok: false, error: "Invalid or expired link." };
  if (record.usedAt) return { ok: false, error: "This link has already been used." };
  if (new Date() > record.expiresAt) return { ok: false, error: "This link has expired." };

  const hashed = await bcrypt.hash(newPassword, 12);

  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { password: hashed } }),
    db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);

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
