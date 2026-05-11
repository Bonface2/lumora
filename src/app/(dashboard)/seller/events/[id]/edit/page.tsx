import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPayoutMethods } from "@/app/actions/payout";
import { CreateEventForm } from "@/app/(dashboard)/seller/events/new/CreateEventForm";
import type { CreateEventFormData } from "@/lib/schemas/event";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [event, payoutMethods, paidOrderCount] = await Promise.all([
    db.event.findFirst({
      where: { id, sellerId: session.user.id },
      include: {
        ticketCategories: {
          include: { installmentPlan: { include: { scheduleItems: true } } },
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
    getPayoutMethods(),
    db.order.count({
      where: {
        ticketCategory: { eventId: id },
        status: { notIn: ["PENDING", "CANCELLED"] },
      },
    }),
  ]);

  if (!event) notFound();

  const defaultValues: CreateEventFormData = {
    title: event.title,
    description: event.description,
    date: event.date.toISOString().slice(0, 16),
    endDate: event.endDate?.toISOString().slice(0, 16) ?? "",
    venue: event.venue,
    city: event.city ?? "",
    coverImage: event.coverImage ?? "",
    payoutMethodId: event.payoutMethodId ?? (payoutMethods.length === 1 ? payoutMethods[0].id : ""),
    eventType: (event.eventType as "FREE" | "PAID") ?? "PAID",
    experienceType: (event.experienceType as "PUBLIC" | "INVITE_ONLY" | "GROUP_TRIP") ?? "PUBLIC",
    isPrivate: event.isPrivate ?? false,
    ticketCategories: event.ticketCategories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description ?? "",
      price: Number(cat.price),
      totalQuantity: cat.totalQuantity,
      allowInstallments: cat.allowInstallments,
      sortOrder: cat.sortOrder,
      installmentPlan: cat.installmentPlan
        ? {
            initialPaymentPercent: Number(cat.installmentPlan.initialPaymentPercent),
            gracePeriodDays: cat.installmentPlan.gracePeriodDays,
            enforceRevocation: cat.installmentPlan.enforceRevocation,
            scheduleItems: cat.installmentPlan.scheduleItems.map((item) => ({
              installmentNumber: item.installmentNumber,
              percentage: Number(item.percentage),
              dueDate: item.dueDate.toISOString().slice(0, 10),
            })),
          }
        : undefined,
    })),
  };

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <a href={`/seller/events/${id}`} className="text-sm text-primary-600 hover:underline">
          ← Back to event
        </a>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Edit event</h1>
      </div>
      <CreateEventForm
        eventId={id}
        defaultValues={defaultValues}
        payoutMethods={payoutMethods}
        payoutMethodLocked={paidOrderCount > 0}
      />
    </div>
  );
}
