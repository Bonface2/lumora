import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ScannerClient } from "./ScannerClient";

export default async function ValidatePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=/validate/${eventId}`);

  const event = await db.event.findFirst({
    where: { id: eventId, sellerId: session.user.id },
    select: { id: true, title: true, date: true, venue: true },
  });
  if (!event) notFound();

  const categoryIds = await db.ticketCategory
    .findMany({ where: { eventId }, select: { id: true } })
    .then((cats) => cats.map((c) => c.id));

  const [checkedInCount, totalSold] = await Promise.all([
    db.ticket.count({
      where: { ticketCategoryId: { in: categoryIds }, checkedInAt: { not: null } },
    }),
    db.ticket.count({
      where: { ticketCategoryId: { in: categoryIds }, status: "ACTIVE" },
    }),
  ]);

  return (
    <ScannerClient
      eventId={event.id}
      eventTitle={event.title}
      initialCheckedIn={checkedInCount}
      totalSold={totalSold}
    />
  );
}
