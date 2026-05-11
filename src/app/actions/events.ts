"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createEventSchema, editEventSchema, type CreateEventFormData } from "@/lib/schemas/event";
import { initializePayment, generateReference } from "@/lib/paystack";
import { cancelInstallmentJobs, cancelSellerAlertJobs, scheduleDefaultWarnings, scheduleTicketRevocation } from "@/lib/queue";
import { sendTicketRevocationNotice, sendTicketReinstatementNotice } from "@/lib/email";
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

  // For PAID events, verify payout method belongs to this seller
  if (data.eventType === "PAID") {
    if (!data.payoutMethodId) {
      return { ok: false, error: "Select a payout method." };
    }
    const payoutMethod = await db.payoutMethod.findFirst({
      where: { id: data.payoutMethodId, sellerId: session.user.id },
    });
    if (!payoutMethod) {
      return { ok: false, error: "Selected payout method not found. Please add one in Settings." };
    }
  }

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
      payoutMethodId: data.eventType === "PAID" ? (data.payoutMethodId ?? null) : null,
      eventType: data.eventType,
      experienceType: data.experienceType,
      isPrivate: data.isPrivate,
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
                    enforceRevocation: cat.installmentPlan.enforceRevocation ?? true,
                    graceOverridesEventCutoff: cat.installmentPlan.graceOverridesEventCutoff ?? false,
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
    include: { ticketCategories: { where: { isComplimentary: false } } },
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

export async function updateEvent(
  eventId: string,
  input: CreateEventFormData
): Promise<ApiResponse<{ id: string }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "SELLER") {
    return { ok: false, error: "Unauthorized." };
  }

  const parsed = editEventSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid form data." };
  }
  const data = parsed.data;

  const existingEvent = await db.event.findFirst({
    where: { id: eventId, sellerId: session.user.id },
    include: {
      ticketCategories: {
        include: { installmentPlan: { include: { scheduleItems: true } } },
      },
    },
  });
  if (!existingEvent) return { ok: false, error: "Event not found." };

  // Validate installment percentages
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

  // For PAID events: lock and verify payout method
  if (data.eventType === "PAID") {
    if (!data.payoutMethodId) {
      return { ok: false, error: "Select a payout method." };
    }
    if (data.payoutMethodId !== existingEvent.payoutMethodId) {
      const hasPaidOrders = await db.order.count({
        where: {
          ticketCategory: { eventId },
          status: { notIn: ["PENDING", "CANCELLED"] },
        },
      });
      if (hasPaidOrders > 0) {
        return {
          ok: false,
          error: "Payout method cannot be changed once payments have been received for this event.",
        };
      }
    }
    const payoutMethod = await db.payoutMethod.findFirst({
      where: { id: data.payoutMethodId, sellerId: session.user.id },
    });
    if (!payoutMethod) {
      return { ok: false, error: "Selected payout method not found. Please add one in Settings." };
    }
  }

  await db.event.update({
    where: { id: eventId },
    data: {
      title: data.title,
      description: data.description,
      date: new Date(data.date),
      endDate: data.endDate ? new Date(data.endDate) : null,
      venue: data.venue,
      city: data.city ?? null,
      coverImage: data.coverImage ?? null,
      payoutMethodId: data.eventType === "PAID" ? (data.payoutMethodId ?? null) : null,
      experienceType: data.experienceType,
      isPrivate: data.isPrivate,
    },
  });

  const incomingIds = new Set(
    data.ticketCategories.filter((c) => c.id).map((c) => c.id as string)
  );

  // Delete removed categories that have no tickets sold
  for (const existing of existingEvent.ticketCategories) {
    if (!incomingIds.has(existing.id) && existing.soldQuantity === 0) {
      await db.ticketCategory.delete({ where: { id: existing.id } });
    }
  }

  const existingById = new Map(existingEvent.ticketCategories.map((c) => [c.id, c]));

  for (let i = 0; i < data.ticketCategories.length; i++) {
    const cat = data.ticketCategories[i];

    if (cat.id && existingById.has(cat.id)) {
      const existing = existingById.get(cat.id)!;

      // Prevent lowering quantity below what's already sold
      const safeQty = Math.max(cat.totalQuantity, existing.soldQuantity);

      await db.ticketCategory.update({
        where: { id: cat.id },
        data: {
          name: cat.name,
          description: cat.description ?? null,
          price: cat.price,
          totalQuantity: safeQty,
          allowInstallments: cat.allowInstallments,
          sortOrder: i,
        },
      });

      if (cat.allowInstallments && cat.installmentPlan) {
        if (existing.installmentPlan) {
          // Delete all schedule items and recreate
          await db.installmentScheduleItem.deleteMany({
            where: { installmentPlanId: existing.installmentPlan.id },
          });
          await db.installmentPlan.update({
            where: { id: existing.installmentPlan.id },
            data: {
              initialPaymentPercent: cat.installmentPlan.initialPaymentPercent,
              gracePeriodDays: cat.installmentPlan.gracePeriodDays,
              enforceRevocation: cat.installmentPlan.enforceRevocation ?? true,
              scheduleItems: {
                create: cat.installmentPlan.scheduleItems.map((item) => ({
                  installmentNumber: item.installmentNumber,
                  percentage: item.percentage,
                  dueDate: new Date(item.dueDate),
                })),
              },
            },
          });
        } else {
          await db.installmentPlan.create({
            data: {
              ticketCategoryId: cat.id,
              initialPaymentPercent: cat.installmentPlan.initialPaymentPercent,
              gracePeriodDays: cat.installmentPlan.gracePeriodDays,
              enforceRevocation: cat.installmentPlan.enforceRevocation ?? true,
              scheduleItems: {
                create: cat.installmentPlan.scheduleItems.map((item) => ({
                  installmentNumber: item.installmentNumber,
                  percentage: item.percentage,
                  dueDate: new Date(item.dueDate),
                })),
              },
            },
          });
        }
      } else if (!cat.allowInstallments && existing.installmentPlan) {
        await db.installmentPlan.delete({ where: { id: existing.installmentPlan.id } });
      }
    } else {
      // New category
      await db.ticketCategory.create({
        data: {
          eventId,
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
                    enforceRevocation: cat.installmentPlan.enforceRevocation ?? true,
                    graceOverridesEventCutoff: cat.installmentPlan.graceOverridesEventCutoff ?? false,
                    scheduleItems: {
                      create: cat.installmentPlan.scheduleItems.map((item) => ({
                        installmentNumber: item.installmentNumber,
                        percentage: item.percentage,
                        dueDate: new Date(item.dueDate),
                      })),
                    },
                  },
                },
              }
            : {}),
        },
      });
    }
  }

  return { ok: true, data: { id: eventId } };
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

export async function initiateEventActivationFee(
  eventId: string,
  tierId: string
): Promise<ApiResponse<{ authorizationUrl: string }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "SELLER") {
    return { ok: false, error: "Unauthorized." };
  }

  const [event, tier] = await Promise.all([
    db.event.findFirst({ where: { id: eventId, sellerId: session.user.id } }),
    db.platformFeeTier.findUnique({ where: { id: tierId } }),
  ]);

  if (!event) return { ok: false, error: "Event not found." };
  if (event.eventType !== "FREE") return { ok: false, error: "This event is not a free event." };
  if (event.platformFeePaid) return { ok: false, error: "Activation fee already paid." };
  if (!tier || !tier.isActive) return { ok: false, error: "Invalid tier selected." };

  const reference = generateReference("ACT");

  const res = await initializePayment({
    email: session.user.email!,
    amount: tier.price * 100, // convert KES to smallest unit
    reference,
    metadata: {
      type: "free_event_fee",
      eventId,
      tierId: tier.id,
      tierCap: tier.maxCap,
      tierPrice: tier.price,
    },
    callback_url: `${process.env.NEXTAUTH_URL}/seller/events/${eventId}/activate/callback`,
  });

  return { ok: true, data: { authorizationUrl: res.data.authorization_url } };
}

export async function initiateEventTierUpgrade(
  eventId: string,
  tierId: string
): Promise<ApiResponse<{ authorizationUrl: string }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "SELLER") {
    return { ok: false, error: "Unauthorized." };
  }

  const [event, tier] = await Promise.all([
    db.event.findFirst({ where: { id: eventId, sellerId: session.user.id } }),
    db.platformFeeTier.findUnique({ where: { id: tierId } }),
  ]);

  if (!event) return { ok: false, error: "Event not found." };
  if (event.eventType !== "FREE") return { ok: false, error: "This event is not a free event." };
  if (!event.platformFeePaid) return { ok: false, error: "Please complete the initial activation first." };
  if (!tier || !tier.isActive) return { ok: false, error: "Invalid tier selected." };

  const alreadyPaid = Number(event.platformFeeAmount ?? 0);
  if (tier.price <= alreadyPaid) {
    return { ok: false, error: "You are already on this tier or higher." };
  }

  const upgradeCost = tier.price - alreadyPaid;
  const reference = generateReference("UPG");

  const res = await initializePayment({
    email: session.user.email!,
    amount: upgradeCost * 100,
    reference,
    metadata: {
      type: "free_event_fee",
      eventId,
      tierId: tier.id,
      tierCap: tier.maxCap,
      tierPrice: tier.price,
      isUpgrade: true,
    },
    callback_url: `${process.env.NEXTAUTH_URL}/seller/events/${eventId}`,
  });

  return { ok: true, data: { authorizationUrl: res.data.authorization_url } };
}

export async function sellerRevokeOrder(
  orderId: string
): Promise<ApiResponse<null>> {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "SELLER" && role !== "ADMIN")) {
    return { ok: false, error: "Unauthorized." };
  }

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      quantity: true,
      ticketCategoryId: true,
      buyer: { select: { email: true, name: true } },
      ticketCategory: {
        select: {
          event: { select: { sellerId: true, title: true } },
        },
      },
    },
  });

  if (!order) return { ok: false, error: "Order not found." };
  if (role === "SELLER" && order.ticketCategory.event.sellerId !== session.user.id) {
    return { ok: false, error: "Unauthorized." };
  }
  if (order.status === "REVOKED") return { ok: false, error: "Order already revoked." };
  if (order.status === "CANCELLED") return { ok: false, error: "Order is cancelled." };

  await db.$transaction([
    db.installmentPayment.updateMany({
      where: { orderId, status: { in: ["PENDING", "OVERDUE"] } },
      data: { status: "DEFAULTED" },
    }),
    db.ticket.updateMany({
      where: { orderId },
      data: { status: "REVOKED" },
    }),
    db.order.update({
      where: { id: orderId },
      data: { status: "REVOKED" },
    }),
    db.ticketCategory.update({
      where: { id: order.ticketCategoryId },
      data: { soldQuantity: { decrement: order.quantity } },
    }),
  ]);

  try {
    await sendTicketRevocationNotice({
      to: order.buyer.email,
      name: order.buyer.name ?? "there",
      eventTitle: order.ticketCategory.event.title,
      reason: "Your ticket has been revoked by the event organiser.",
    });
  } catch (err) {
    console.error("[sellerRevokeOrder] revocation email failed:", err);
  }

  return { ok: true, data: null };
}

export async function sellerReinstateOrder(
  orderId: string
): Promise<ApiResponse<null>> {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "SELLER" && role !== "ADMIN")) {
    return { ok: false, error: "Unauthorized." };
  }

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      paidAmount: true,
      totalAmount: true,
      quantity: true,
      ticketCategoryId: true,
      buyer: { select: { email: true, name: true } },
      ticketCategory: {
        select: { event: { select: { sellerId: true, title: true } } },
      },
    },
  });

  if (!order) return { ok: false, error: "Order not found." };
  if (role === "SELLER" && order.ticketCategory.event.sellerId !== session.user.id) {
    return { ok: false, error: "Unauthorized." };
  }
  if (order.status !== "REVOKED") return { ok: false, error: "Order is not revoked." };

  const isFullyPaid = Number(order.paidAmount) >= Number(order.totalAmount);
  await db.$transaction([
    db.ticket.updateMany({ where: { orderId }, data: { status: "ACTIVE" } }),
    db.installmentPayment.updateMany({
      where: { orderId, status: "DEFAULTED" },
      data: { status: "OVERDUE" },
    }),
    db.order.update({
      where: { id: orderId },
      data: { status: isFullyPaid ? "PAID_IN_FULL" : "PARTIAL_PAID" },
    }),
    db.ticketCategory.update({
      where: { id: order.ticketCategoryId },
      data: { soldQuantity: { increment: order.quantity } },
    }),
  ]);

  try {
    await sendTicketReinstatementNotice({
      to: order.buyer.email,
      name: order.buyer.name ?? "there",
      eventTitle: order.ticketCategory.event.title,
    });
  } catch (err) {
    console.error("[sellerReinstateOrder] reinstatement email failed:", err);
  }

  return { ok: true, data: null };
}

export async function generatePrivateInviteLink(
  eventId: string,
  maxUses: number
): Promise<ApiResponse<{ url: string; maxUses: number }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "SELLER") {
    return { ok: false, error: "Unauthorized." };
  }
  if (maxUses < 1 || maxUses > 100) {
    return { ok: false, error: "Number of invites must be between 1 and 100." };
  }

  const event = await db.event.findFirst({
    where: { id: eventId, sellerId: session.user.id },
    select: { slug: true, isPrivate: true },
  });

  if (!event) return { ok: false, error: "Event not found." };
  if (!event.isPrivate) return { ok: false, error: "Event is not private." };

  const record = await db.privateEventToken.create({
    data: { eventId, maxUses },
  });

  return {
    ok: true,
    data: {
      url: `${process.env.NEXT_PUBLIC_APP_URL}/events/${event.slug}?invite=${record.token}`,
      maxUses,
    },
  };
}

export async function extendGracePeriod(
  orderId: string,
  extraDays: number
): Promise<ApiResponse<null>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "SELLER") {
    return { ok: false, error: "Unauthorized." };
  }

  if (extraDays < 1 || extraDays > 30) {
    return { ok: false, error: "Extension must be between 1 and 30 days." };
  }

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      ticketCategory: {
        include: {
          event: true,
          installmentPlan: true,
        },
      },
      payments: {
        where: { paymentNumber: { gt: 0 } },
        orderBy: { dueDate: "asc" },
      },
    },
  });

  if (!order) return { ok: false, error: "Order not found." };
  if (order.ticketCategory.event.sellerId !== session.user.id) {
    return { ok: false, error: "Unauthorized." };
  }
  if (order.status === "REVOKED" || order.status === "CANCELLED" || order.status === "PAID_IN_FULL") {
    return { ok: false, error: "Cannot extend grace period for this order." };
  }

  const now = new Date();
  const overduePayment = order.payments.find(
    (p) => (p.status === "PENDING" || p.status === "OVERDUE" || p.status === "DEFAULTED") && p.dueDate < now
  );
  if (!overduePayment) {
    return { ok: false, error: "No overdue payment found for this order." };
  }

  const updatedOrder = await db.order.update({
    where: { id: orderId },
    data: { graceExtensionDays: { increment: extraDays } },
    select: { graceExtensionDays: true },
  });

  const plan = order.ticketCategory.installmentPlan;
  const basePlanDays = plan?.gracePeriodDays ?? 7;
  const effectiveGraceDays = basePlanDays + updatedOrder.graceExtensionDays;
  const eventDate = order.ticketCategory.event.date;

  // Cancel existing jobs for this payment and seller alerts
  await cancelInstallmentJobs([overduePayment.id]);
  await cancelSellerAlertJobs(orderId);

  // Reschedule with extended grace period
  await scheduleDefaultWarnings(overduePayment.id, orderId, overduePayment.dueDate, effectiveGraceDays, eventDate, true);
  await scheduleTicketRevocation(orderId, overduePayment.id, overduePayment.dueDate, effectiveGraceDays, eventDate);

  return { ok: true, data: null };
}
