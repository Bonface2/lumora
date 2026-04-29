import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendTicketConfirmation } from "@/lib/email";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const result = await sendTicketConfirmation({
    to: session.user.email!,
    name: session.user.name ?? "there",
    eventTitle: "Test Event — Email Debug",
    categoryName: "General Admission",
    ticketNumbers: ["TEST-ABC12345", "TEST-XYZ67890"],
    eventDate: "Saturday, 01 January 2026 · 18:00",
    venue: "Lumora Test Venue, Nairobi",
  });

  return NextResponse.json({
    to: session.user.email,
    result,
  });
}
