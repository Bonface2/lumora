import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { format } from "date-fns";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { EventStatus } from "@prisma/client";

const statusVariant: Record<EventStatus, "default" | "primary" | "success" | "warning" | "danger"> = {
  DRAFT: "default",
  PUBLISHED: "success",
  CANCELLED: "danger",
  COMPLETED: "info" as "default",
};

export default async function SellerEventsPage() {
  const session = await auth();
  const events = await db.event.findMany({
    where: { sellerId: session!.user.id },
    include: {
      ticketCategories: {
        select: { soldQuantity: true, totalQuantity: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Events</h1>
          <p className="mt-1 text-sm text-gray-500">
            {events.length} event{events.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {events.length > 0 && (
            <>
              <a href="/api/seller/export?format=csv" download>
                <Button variant="ghost" size="sm">
                  <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  CSV
                </Button>
              </a>
              <a href="/api/seller/export?format=xlsx" download>
                <Button variant="ghost" size="sm">
                  <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Excel
                </Button>
              </a>
            </>
          )}
          <a href="/seller/events/new">
            <Button>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Create event
            </Button>
          </a>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-20 text-center">
          <svg className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="mt-4 text-lg font-medium text-gray-900">No events yet</p>
          <p className="mt-1 text-sm text-gray-500">Create your first event to start selling tickets.</p>
          <a href="/seller/events/new" className="mt-4">
            <Button>Create your first event</Button>
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => {
            const totalSold = event.ticketCategories.reduce((s, c) => s + c.soldQuantity, 0);
            const totalAvail = event.ticketCategories.reduce((s, c) => s + c.totalQuantity, 0);
            return (
              <div key={event.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4">
                  {event.coverImage ? (
                    <img src={event.coverImage} alt="" className="h-14 w-14 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-violet-100">
                      <svg className="h-6 w-6 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-gray-900">{event.title}</h2>
                      <Badge variant={statusVariant[event.status] ?? "default"}>
                        {event.status}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {format(event.date, "dd MMM yyyy")} · {event.venue}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {totalSold} / {totalAvail} tickets sold
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a href={`/seller/events/${event.id}`}>
                    <Button variant="secondary" size="sm">View</Button>
                  </a>
                  <a href={`/seller/events/${event.id}/edit`}>
                    <Button variant="ghost" size="sm">Edit</Button>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
