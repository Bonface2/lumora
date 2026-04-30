import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ valid: false, reason: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { ticketNumber, eventId } = body ?? {};

  if (!ticketNumber || !eventId) {
    return NextResponse.json({ valid: false, reason: "Missing ticketNumber or eventId" }, { status: 400 });
  }

  // Verify the authenticated user owns this event
  const event = await db.event.findFirst({
    where: { id: eventId, sellerId: session.user.id },
    select: { id: true, title: true },
  });
  if (!event) {
    return NextResponse.json({ valid: false, reason: "Event not found or access denied" }, { status: 403 });
  }

  const ticket = await db.ticket.findUnique({
    where: { ticketNumber },
  });

  if (!ticket) {
    return NextResponse.json({ valid: false, reason: "Ticket not found" });
  }

  const category = await db.ticketCategory.findUnique({
    where: { id: ticket.ticketCategoryId },
    select: { name: true, eventId: true },
  });

  if (!category || category.eventId !== eventId) {
    return NextResponse.json({ valid: false, reason: "Ticket is for a different event" });
  }

  if (ticket.status === "REVOKED") {
    return NextResponse.json({ valid: false, reason: "Ticket has been revoked" });
  }

  if (ticket.checkedInAt) {
    return NextResponse.json({
      valid: false,
      reason: `Already checked in at ${ticket.checkedInAt.toISOString()}`,
      checkedInAt: ticket.checkedInAt.toISOString(),
    });
  }

  // Valid — mark as checked in
  const updated = await db.ticket.update({
    where: { ticketNumber },
    data: { checkedInAt: new Date() },
  });

  return NextResponse.json({
    valid: true,
    ticketNumber: ticket.ticketNumber,
    categoryName: category.name,
    eventTitle: event.title,
    checkedInAt: updated.checkedInAt!.toISOString(),
  });
}
