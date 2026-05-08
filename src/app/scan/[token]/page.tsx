import { verifyScanToken } from "@/lib/scanToken";
import { db } from "@/lib/db";
import { ScannerClient } from "@/app/validate/[eventId]/ScannerClient";

export default async function ScanPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const payload = verifyScanToken(token);

  if (!payload) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-6 text-center">
        <svg className="h-16 w-16 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <h1 className="mt-4 text-xl font-bold text-white">Scan link expired or invalid</h1>
        <p className="mt-2 text-sm text-gray-400">
          This scan link has expired or is no longer valid. The event organiser can generate a new link from their dashboard.
        </p>
      </div>
    );
  }

  const categoryIds = await db.ticketCategory
    .findMany({ where: { eventId: payload.eventId }, select: { id: true } })
    .then((cats) => cats.map((c) => c.id));

  const [event, checkedInCount, totalSold] = await Promise.all([
    db.event.findUnique({
      where: { id: payload.eventId },
      select: { id: true, title: true, date: true, venue: true },
    }),
    db.ticket.count({
      where: { ticketCategoryId: { in: categoryIds }, checkedInAt: { not: null } },
    }),
    db.ticket.count({
      where: { ticketCategoryId: { in: categoryIds }, status: "ACTIVE" },
    }),
  ]);

  if (!event) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-6 text-center">
        <p className="text-white">Event not found.</p>
      </div>
    );
  }

  return (
    <ScannerClient
      eventId={event.id}
      eventTitle={event.title}
      initialCheckedIn={checkedInCount}
      totalSold={totalSold}
    />
  );
}
