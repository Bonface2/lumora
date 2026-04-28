"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createEventSchema, type CreateEventFormData } from "@/lib/schemas/event";
import type { ApiResponse } from "@/types";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  let i = 0;
  while (await db.event.findUnique({ where: { slug } })) {
    slug = `${base}-${++i}`;
  }
  return slug;
}

export async function createEvent(
  input: CreateEventFormData
): Promise<ApiResponse<{ id: string }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "SELLER") {
    return { ok: false, error: "Unauthorized." };
  }

  const parsed = createEventSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid form data." };
  }

  const data = parsed.data;

  // Validate installment percentages sum to 100 for each category that has them
  for (const cat of data.ticketCategories) {
    if (cat.allowInstallments && cat.installmentPlan) {
      const { initialPaymentPercent, scheduleItems } = cat.installmentPlan;
      const scheduleTotal = scheduleItems.reduce((s: number, i: { percentage: number }) => s + i.percentage, 0);
      const total = initialPaymentPercent + scheduleTotal;
      if (Math.abs(total - 100) > 0.01) {
        return {
          ok: false,
          error: `Installment percentages for "${cat.name}" must add up to 100% (currently ${total}%).`,
        };
      }
    }
  }

  const slug = await uniqueSlug(slugify(data.title));

  const event = await db.event.create({
    data: {
      sellerId: session.user.id,
      title: data.title,
      slug,
      description: data.description,
      date: new Date(data.date),
      endDate: data.endDate ? new Date(data.endDate) : null,
      venue: data.venue,
      city: data.city ?? null,
      coverImage: data.coverImage ?? null,
      status: "DRAFT",
      ticketCategories: {
        create: data.ticketCategories.map((cat: CreateEventFormData["ticketCategories"][number], i: number) => ({
          name: cat.name,
          description: cat.description ?? null,
          price: cat.price,
          totalQuantity: cat.totalQuantity,
          allowInstallments: cat.allowInstallments,
          sortOrder: i,
          ...(cat.allowInstallments && cat.installmentPlan
            ? {
                installmentPlan: {
                  create: {
                    initialPaymentPercent: cat.installmentPlan.initialPaymentPercent,
                    gracePeriodDays: cat.installmentPlan.gracePeriodDays,
                    scheduleItems: {
                      create: cat.installmentPlan.scheduleItems.map((item: { installmentNumber: number; percentage: number; dueDate: string }) => ({
                        installmentNumber: item.installmentNumber,
                        percentage: item.percentage,
                        dueDate: new Date(item.dueDate),
                      })),
                    },
                  },
                },
              }
            : {}),
        })),
      },
    },
  });

  return { ok: true, data: { id: event.id } };
}

export async function publishEvent(
  eventId: string
): Promise<ApiResponse<{ status: string }>> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Unauthorized." };

  const event = await db.event.findFirst({
    where: { id: eventId, sellerId: session.user.id },
    include: { ticketCategories: true },
  });

  if (!event) return { ok: false, error: "Event not found." };
  if (event.ticketCategories.length === 0)
    return { ok: false, error: "Add at least one ticket category before publishing." };

  await db.event.update({
    where: { id: eventId },
    data: { status: "PUBLISHED" },
  });

  return { ok: true, data: { status: "PUBLISHED" } };
}

export async function unpublishEvent(
  eventId: string
): Promise<ApiResponse<{ status: string }>> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Unauthorized." };

  await db.event.updateMany({
    where: { id: eventId, sellerId: session.user.id },
    data: { status: "DRAFT" },
  });

  return { ok: true, data: { status: "DRAFT" } };
}
