import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
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

  const defaultValues: CreateEventFormData = {
    title: event.title,
    description: event.description,
    date: event.date.toISOString().slice(0, 16),
    endDate: event.endDate?.toISOString().slice(0, 16) ?? "",
    venue: event.venue,
    city: event.city ?? "",
    coverImage: event.coverImage ?? "",
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
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <a href={`/seller/events/${id}`} className="text-sm text-primary-600 hover:underline">
          ← Back to event
        </a>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Edit event</h1>
      </div>
      <CreateEventForm eventId={id} defaultValues={defaultValues} />
    </div>
  );
}
