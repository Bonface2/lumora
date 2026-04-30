import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const category = await db.ticketCategory.findUnique({
    where: { id },
    include: {
      event: true,
      installmentPlan: {
        include: { scheduleItems: { orderBy: { installmentNumber: "asc" } } },
      },
    },
  });

  if (!category) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date();
  const plan = category.installmentPlan;
  const pastDueItems = plan?.scheduleItems.filter((s) => s.dueDate <= now) ?? [];
  const futureItems = plan?.scheduleItems.filter((s) => s.dueDate > now) ?? [];
  const pastDuePct = pastDueItems.reduce((sum, s) => sum + Number(s.percentage), 0);
  const effectiveInitialPercent = plan
    ? Number(plan.initialPaymentPercent) + pastDuePct
    : 100;

  return NextResponse.json({
    name: category.name,
    price: Number(category.price),
    eventTitle: category.event.title,
    eventDate: category.event.date.toISOString(),
    venue: category.event.venue,
    city: category.event.city,
    coverImage: category.event.coverImage,
    eventSlug: category.event.slug,
    allowInstallments: category.allowInstallments,
    installmentPlan: plan
      ? {
          initialPaymentPercent: effectiveInitialPercent,
          consolidatedCount: pastDueItems.length,
          scheduleItems: futureItems.map((s) => ({
            installmentNumber: s.installmentNumber,
            percentage: Number(s.percentage),
            dueDate: s.dueDate.toISOString(),
          })),
        }
      : null,
  });
}
