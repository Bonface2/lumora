import { notFound, redirect } from "next/navigation";
import { format } from "date-fns";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { PublishButton } from "./PublishButton";
import type { EventStatus } from "@prisma/client";

const statusVariant: Record<EventStatus, "default" | "success" | "danger" | "warning"> = {
  DRAFT: "default",
  PUBLISHED: "success",
  CANCELLED: "danger",
  COMPLETED: "warning",
};

export default async function SellerEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const event = await db.event.findFirst({
    where: { id, sellerId: session.user.id },
    include: {
      ticketCategories: {
        include: { installmentPlan: { include: { scheduleItems: true } } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!event) notFound();

  const totalSold = event.ticketCategories.reduce((s, c) => s + c.soldQuantity, 0);
  const totalAvail = event.ticketCategories.reduce((s, c) => s + c.totalQuantity, 0);
  const totalRevenue = event.ticketCategories.reduce(
    (s, c) => s + Number(c.price) * c.soldQuantity,
    0
  );

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <a href="/seller" className="text-sm text-violet-600 hover:underline">
            ← Back to events
          </a>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
            <Badge variant={statusVariant[event.status]}>{event.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {format(event.date, "EEEE, dd MMM yyyy · HH:mm")}
            {event.endDate && ` — ${format(event.endDate, "HH:mm")}`}
            {" · "}
            {event.venue}
            {event.city && `, ${event.city}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {event.status === "PUBLISHED" && (
            <a href={`/events/${event.slug}`} target="_blank">
              <Button variant="ghost" size="sm">View public page ↗</Button>
            </a>
          )}
          {event.status === "PUBLISHED" && (
            <a href={`/validate/${id}`} target="_blank">
              <Button variant="secondary" size="sm">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                Scan tickets
              </Button>
            </a>
          )}
          {totalSold > 0 && (
            <>
              <a href={`/api/seller/events/${id}/export?format=csv`} download>
                <Button variant="ghost" size="sm">
                  <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  CSV
                </Button>
              </a>
              <a href={`/api/seller/events/${id}/export?format=xlsx`} download>
                <Button variant="ghost" size="sm">
                  <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Excel
                </Button>
              </a>
            </>
          )}
          <a href={`/seller/events/${id}/edit`}>
            <Button variant="secondary" size="sm">Edit</Button>
          </a>
          {(event.status === "DRAFT" || event.status === "PUBLISHED") && (
            <PublishButton eventId={id} status={event.status} />
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        {[
          { label: "Tickets sold", value: `${totalSold} / ${totalAvail}` },
          {
            label: "Revenue",
            value: `KES ${totalRevenue.toLocaleString()}`,
          },
          {
            label: "Remaining",
            value: `${totalAvail - totalSold}`,
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardBody>
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{stat.value}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Ticket categories */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-gray-900">Ticket categories</h2>
        </CardHeader>
        <div className="divide-y divide-gray-100">
          {event.ticketCategories.map((cat) => (
            <div key={cat.id} className="px-6 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{cat.name}</p>
                    {cat.allowInstallments && (
                      <Badge variant="primary">Installments</Badge>
                    )}
                    {cat.soldQuantity >= cat.totalQuantity && (
                      <Badge variant="danger">Sold out</Badge>
                    )}
                  </div>
                  {cat.description && (
                    <p className="mt-0.5 text-sm text-gray-500">{cat.description}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">
                    KES {Number(cat.price).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500">
                    {cat.soldQuantity} / {cat.totalQuantity} sold
                  </p>
                </div>
              </div>

              {/* Installment plan summary */}
              {cat.installmentPlan && (
                <div className="mt-3 rounded-lg bg-violet-50 px-4 py-3 text-sm">
                  <p className="font-medium text-violet-800">
                    Initial payment: {Number(cat.installmentPlan.initialPaymentPercent)}%
                    {" · "}Grace: {cat.installmentPlan.gracePeriodDays} days
                    {" · "}Resale cutoff: 3 days before event
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {cat.installmentPlan.scheduleItems.map((item) => (
                      <span
                        key={item.id}
                        className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs text-violet-700"
                      >
                        Installment {item.installmentNumber}: {Number(item.percentage)}% due{" "}
                        {format(item.dueDate, "dd MMM yyyy")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Description */}
      <Card className="mt-6">
        <CardHeader>
          <h2 className="font-semibold text-gray-900">About this event</h2>
        </CardHeader>
        <CardBody>
          <p className="whitespace-pre-line text-sm text-gray-700">{event.description}</p>
        </CardBody>
      </Card>
    </div>
  );
}
