"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEventInvite } from "@/lib/email";
import { format } from "date-fns";
import type { ApiResponse } from "@/types";

export async function sendEventInvites(input: {
  eventId: string;
  invites: { email: string; name?: string }[];
}): Promise<ApiResponse<{ sent: number }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "SELLER") {
    return { ok: false, error: "Unauthorized." };
  }

  const { eventId, invites } = input;

  const event = await db.event.findFirst({
    where: { id: eventId, sellerId: session.user.id },
  });
  if (!event) return { ok: false, error: "Event not found." };
  if (!event.isPrivate) return { ok: false, error: "Event is not private." };

  const eventDate = format(event.date, "EEEE, dd MMMM yyyy · HH:mm");
  const venue = `${event.venue}${event.city ? `, ${event.city}` : ""}`;
  let sent = 0;

  for (const invite of invites) {
    const email = invite.email.trim().toLowerCase();
    if (!email) continue;

    // Upsert invite record
    await db.eventInvite.upsert({
      where: { eventId_email: { eventId, email } },
      create: { eventId, email, name: invite.name ?? null, sentAt: new Date() },
      update: { name: invite.name ?? undefined, sentAt: new Date() },
    });

    try {
      await sendEventInvite(email, invite.name ?? null, {
        title: event.title,
        date: eventDate,
        venue,
        slug: event.slug,
      });
      sent++;
    } catch (err) {
      console.error("[invites] email error for", email, err);
    }
  }

  return { ok: true, data: { sent } };
}
