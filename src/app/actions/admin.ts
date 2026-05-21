"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendMoney, getIntaSendProvider, generateReference } from "@/lib/intasend";
import { getPlatformConfig, computeSellerNet } from "@/lib/platformConfig";
import {
  sendTicketReinstatementNotice,
  sendGroupTripApprovedNotice,
  sendGroupTripRejectedNotice,
  sendGroupTripExpansionApprovedNotice,
  sendGroupTripExpansionRejectedNotice,
} from "@/lib/email";
import type { ApiResponse } from "@/types";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session.user;
}

// ─── Event fee management ──────────────────────────────────────────────────────

export async function setEventPlatformFee(
  eventId: string,
  feePercent: number | null
): Promise<ApiResponse<null>> {
  if (!(await requireAdmin())) return { ok: false, error: "Unauthorized." };

  if (feePercent !== null && (feePercent < 0 || feePercent > 100)) {
    return { ok: false, error: "Fee must be between 0 and 100." };
  }

  await db.event.update({
    where: { id: eventId },
    data: { platformFeePercent: feePercent },
  });

  return { ok: true, data: null };
}

export async function getAdminEvent(eventId: string) {
  if (!(await requireAdmin())) return null;

  return db.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      date: true,
      venue: true,
      status: true,
      eventType: true,
      experienceType: true,
      platformFeePercent: true,
      platformFlatFee: true,
      seller: { select: { name: true, email: true } },
    },
  });
}

export async function setEventFlatFee(
  eventId: string,
  flatFee: number | null,
): Promise<ApiResponse<null>> {
  if (!(await requireAdmin())) return { ok: false, error: "Unauthorized." };
  if (flatFee !== null && flatFee < 0) {
    return { ok: false, error: "Fee cannot be negative." };
  }
  await db.event.update({
    where: { id: eventId },
    data: { platformFlatFee: flatFee },
  });
  return { ok: true, data: null };
}

export async function getAdminPlatformConfig() {
  if (!(await requireAdmin())) return null;
  return getPlatformConfig();
}

export async function updatePlatformConfig(input: {
  paidFeePercent: number;
  groupTripFlatFee: number;
  groupTripAutoApproveCap: number;
}): Promise<ApiResponse<null>> {
  if (!(await requireAdmin())) return { ok: false, error: "Unauthorized." };
  if (input.paidFeePercent < 0 || input.paidFeePercent > 100)
    return { ok: false, error: "Paid fee must be between 0 and 100." };
  if (input.groupTripFlatFee < 0)
    return { ok: false, error: "Flat fee must be 0 or greater." };
  if (!Number.isInteger(input.groupTripAutoApproveCap) || input.groupTripAutoApproveCap < 1)
    return { ok: false, error: "Auto-approve cap must be a whole number ≥ 1." };

  await db.platformConfig.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      paidFeePercent: input.paidFeePercent,
      groupTripFlatFee: input.groupTripFlatFee,
      groupTripAutoApproveCap: input.groupTripAutoApproveCap,
    },
    update: {
      paidFeePercent: input.paidFeePercent,
      groupTripFlatFee: input.groupTripFlatFee,
      groupTripAutoApproveCap: input.groupTripAutoApproveCap,
    },
  });
  return { ok: true, data: null };
}

// ─── Payout management ────────────────────────────────────────────────────────

export async function getSellerBalances() {
  if (!(await requireAdmin())) return [];

  // All fully-paid orders with their event's fee rate and payout method
  const [orders, platformConfig] = await Promise.all([
    db.order.findMany({
    where: { status: "PAID_IN_FULL" },
    select: {
      totalAmount: true,
      ticketCategory: {
        select: {
          event: {
            select: {
              id: true,
              title: true,
              date: true,
              sellerId: true,
              eventType: true,
              experienceType: true,
              platformFeePercent: true,
              platformFlatFee: true,
              payoutMethodId: true,
              payoutMethod: {
                select: {
                  id: true,
                  label: true,
                  bankName: true,
                  bankCode: true,
                  accountNumber: true,
                  bankType: true,
                },
              },
              seller: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      },
    },
  }),
    getPlatformConfig(),
  ]);

  // Group earnings by (sellerId, payoutMethodId)
  const earnings: Record<string, number> = {};
  const gross: Record<string, number> = {};
  const rows: Record<string, {
    seller: { id: string; name: string | null; email: string };
    payoutMethod: {
      id: string;
      label: string | null;
      bankName: string;
      bankCode: string;
      accountNumber: string;
      bankType: string;
    } | null;
  }> = {};
  const eventBreakdowns: Record<string, Record<string, {
    eventId: string;
    title: string;
    date: Date;
    feeLabel: string;
    grossAmount: number;
    sellerNet: number;
  }>> = {};

  for (const order of orders) {
    const event = order.ticketCategory.event;
    const orderGross = Number(order.totalAmount);
    const { sellerNet, platformFee, feeLabel } = computeSellerNet(
      orderGross,
      event.eventType,
      event.experienceType,
      event.platformFeePercent,
      platformConfig,
    );
    const key = `${event.sellerId}:${event.payoutMethodId ?? "none"}`;

    earnings[key] = (earnings[key] ?? 0) + sellerNet;
    gross[key] = (gross[key] ?? 0) + orderGross;
    rows[key] = {
      seller: { id: event.seller.id, name: event.seller.name, email: event.seller.email },
      payoutMethod: event.payoutMethod
        ? {
            id: event.payoutMethod.id,
            label: event.payoutMethod.label,
            bankName: event.payoutMethod.bankName,
            bankCode: event.payoutMethod.bankCode,
            accountNumber: event.payoutMethod.accountNumber,
            bankType: event.payoutMethod.bankType,
          }
        : null,
    };

    if (!eventBreakdowns[key]) eventBreakdowns[key] = {};
    const evMap = eventBreakdowns[key];
    if (!evMap[event.id]) {
      evMap[event.id] = { eventId: event.id, title: event.title, date: event.date, feeLabel, grossAmount: 0, sellerNet: 0 };
    }
    evMap[event.id].grossAmount += orderGross;
    evMap[event.id].sellerNet += sellerNet;
    void platformFee;
  }

  // Successful payouts grouped by (sellerId, payoutMethodId)
  const payouts = await db.payout.findMany({
    where: { status: "success" },
    select: { sellerId: true, payoutMethodId: true, amount: true },
  });
  const paidOut: Record<string, number> = {};
  for (const p of payouts) {
    const key = `${p.sellerId}:${p.payoutMethodId ?? "none"}`;
    paidOut[key] = (paidOut[key] ?? 0) + Number(p.amount);
  }

  return Object.entries(earnings)
    .map(([key, earned]) => {
      const grossRevenue = Math.round((gross[key] ?? 0) * 100) / 100;
      const events = Object.values(eventBreakdowns[key] ?? {})
        .map((e) => ({
          ...e,
          grossAmount: Math.round(e.grossAmount * 100) / 100,
          sellerNet: Math.round(e.sellerNet * 100) / 100,
        }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return {
        key,
        seller: rows[key].seller,
        payoutMethod: rows[key].payoutMethod,
        grossRevenue,
        platformFee: Math.round((grossRevenue - earned) * 100) / 100,
        earned: Math.round(earned * 100) / 100,
        paidOut: Math.round((paidOut[key] ?? 0) * 100) / 100,
        outstanding: Math.round((earned - (paidOut[key] ?? 0)) * 100) / 100,
        events,
      };
    })
    .filter((b) => b.outstanding > 0.5)
    .sort((a, b) => b.outstanding - a.outstanding);
}

// ─── User management ─────────────────────────────────────────────────────────

export async function adminGetUser(userId: string) {
  if (!(await requireAdmin())) return null;

  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      _count: { select: { orders: true, events: true } },
    },
  });
}

export async function adminGetUserOrders(userId: string) {
  if (!(await requireAdmin())) return [];

  return db.order.findMany({
    where: { buyerId: userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      totalAmount: true,
      status: true,
      createdAt: true,
      ticketCategory: {
        select: { name: true, event: { select: { title: true } } },
      },
    },
  });
}

export async function adminUpdateUserRole(
  userId: string,
  role: "BUYER" | "SELLER" | "ADMIN"
): Promise<ApiResponse<null>> {
  if (!(await requireAdmin())) return { ok: false, error: "Unauthorized." };

  await db.user.update({ where: { id: userId }, data: { role } });
  return { ok: true, data: null };
}

export async function adminDeleteUser(userId: string): Promise<ApiResponse<null>> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: "Unauthorized." };
  if (admin.id === userId) return { ok: false, error: "You cannot delete your own account." };

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, _count: { select: { orders: true, events: true } } },
  });
  if (!user) return { ok: false, error: "User not found." };
  if (user.role === "ADMIN") return { ok: false, error: "Cannot delete another admin account." };
  if (user._count.orders > 0) return { ok: false, error: "Cannot delete a user who has orders. Revoke their access instead." };
  if (user._count.events > 0) return { ok: false, error: "Cannot delete a user who has created events." };

  await db.user.delete({ where: { id: userId } });
  return { ok: true, data: null };
}

export async function reinstateOrder(orderId: string): Promise<ApiResponse<null>> {
  if (!(await requireAdmin())) return { ok: false, error: "Unauthorized." };

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      paidAmount: true,
      totalAmount: true,
      quantity: true,
      ticketCategoryId: true,
      buyer: { select: { email: true, name: true } },
      ticketCategory: { select: { event: { select: { title: true } } } },
    },
  });
  if (!order) return { ok: false, error: "Order not found." };
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
  ]);

  // Restore the sold-quantity counter separately so a stale count never
  // rolls back the ticket reinstatement above.
  try {
    await db.ticketCategory.update({
      where: { id: order.ticketCategoryId },
      data: { soldQuantity: { increment: order.quantity } },
    });
  } catch (err) {
    console.error("[reinstateOrder] soldQuantity increment failed:", err);
  }

  revalidatePath("/admin/orders");
  revalidatePath("/buyer");
  revalidatePath("/seller/events/[id]", "page");
  revalidatePath("/seller/analytics");

  try {
    await sendTicketReinstatementNotice({
      to: order.buyer.email,
      name: order.buyer.name ?? "there",
      eventTitle: order.ticketCategory.event.title,
    });
  } catch (err) {
    console.error("[reinstateOrder] reinstatement email failed:", err);
  }

  return { ok: true, data: null };
}

// ─── Payout management ────────────────────────────────────────────────────────

export async function triggerSellerPayout(
  sellerId: string,
  payoutMethodId: string,
  amount: number
): Promise<ApiResponse<{ payoutId: string }>> {
  if (!(await requireAdmin())) return { ok: false, error: "Unauthorized." };

  if (amount <= 0) return { ok: false, error: "Amount must be greater than zero." };

  const method = await db.payoutMethod.findFirst({
    where: { id: payoutMethodId, sellerId },
    select: { bankCode: true, accountNumber: true, accountName: true, bankType: true },
  });
  if (!method) return { ok: false, error: "Payout method not found." };

  const seller = await db.user.findUnique({
    where: { id: sellerId },
    select: { name: true, email: true },
  });
  if (!seller) return { ok: false, error: "Seller not found." };

  const reference = generateReference("PAY");

  const payout = await db.payout.create({
    data: {
      sellerId,
      payoutMethodId,
      amount,
      reference,
      status: "pending",
      reason: "Lumora ticket sales payout",
    },
  });

  try {
    const provider = getIntaSendProvider(method.bankType);
    const result = await sendMoney({
      provider,
      transactions: [
        {
          name: method.accountName ?? seller.name ?? seller.email ?? "Seller",
          account: method.accountNumber,
          amount,
          narrative: `Lumora payout — ${seller.name ?? seller.email}`,
          ...(provider === "PESALINK" ? { bank_code: method.bankCode } : {}),
          ...(provider === "MPESA-B2B" ? { account_type: "PayBill" as const } : {}),
        },
      ],
      batch_reference: reference,
    });

    await db.payout.update({
      where: { id: payout.id },
      data: { providerRef: result.trackingId, status: result.ok ? "pending" : "failed" },
    });

    return { ok: true, data: { payoutId: payout.id } };
  } catch (err) {
    await db.payout.update({ where: { id: payout.id }, data: { status: "failed" } });
    return { ok: false, error: err instanceof Error ? err.message : "Transfer failed." };
  }
}

// ─── Group trip review ────────────────────────────────────────────────────────

export async function getPendingGroupTrips() {
  if (!(await requireAdmin())) return [];
  return db.event.findMany({
    where: { status: "PENDING_REVIEW", experienceType: "GROUP_TRIP" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      date: true,
      venue: true,
      city: true,
      groupTripCapacity: true,
      createdAt: true,
      seller: { select: { id: true, name: true, email: true } },
      ticketCategories: { select: { name: true, price: true, totalQuantity: true } },
    },
  });
}

export async function getPendingExpansionRequests() {
  if (!(await requireAdmin())) return [];
  return db.groupTripExpansionRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      requestedAdditional: true,
      inviteeDetails: true,
      reason: true,
      createdAt: true,
      event: {
        select: {
          id: true,
          title: true,
          groupTripCapacity: true,
          seller: { select: { name: true, email: true } },
        },
      },
    },
  });
}

export async function approveGroupTrip(eventId: string): Promise<ApiResponse<null>> {
  if (!(await requireAdmin())) return { ok: false, error: "Unauthorized." };

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: {
      status: true,
      title: true,
      groupTripCapacity: true,
      seller: { select: { email: true, name: true } },
    },
  });
  if (!event) return { ok: false, error: "Event not found." };
  if (event.status !== "PENDING_REVIEW") return { ok: false, error: "Event is not pending review." };

  await db.event.update({ where: { id: eventId }, data: { status: "DRAFT" } });
  revalidatePath("/admin/group-trips");

  try {
    await sendGroupTripApprovedNotice({
      to: event.seller.email,
      sellerName: event.seller.name ?? "there",
      eventTitle: event.title,
      capacity: event.groupTripCapacity ?? 0,
    });
  } catch (err) {
    console.error("[approveGroupTrip] email failed:", err);
  }

  return { ok: true, data: null };
}

export async function rejectGroupTrip(eventId: string, reason: string): Promise<ApiResponse<null>> {
  if (!(await requireAdmin())) return { ok: false, error: "Unauthorized." };

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: {
      status: true,
      title: true,
      seller: { select: { email: true, name: true } },
    },
  });
  if (!event) return { ok: false, error: "Event not found." };
  if (event.status !== "PENDING_REVIEW") return { ok: false, error: "Event is not pending review." };

  const { groupTripAutoApproveCap } = await getPlatformConfig();

  await db.event.update({
    where: { id: eventId },
    data: { status: "DRAFT", groupTripCapacity: groupTripAutoApproveCap },
  });
  revalidatePath("/admin/group-trips");

  try {
    await sendGroupTripRejectedNotice({
      to: event.seller.email,
      sellerName: event.seller.name ?? "there",
      eventTitle: event.title,
      reason,
      eventId,
      autoApproveCap: groupTripAutoApproveCap,
    });
  } catch (err) {
    console.error("[rejectGroupTrip] email failed:", err);
  }

  return { ok: true, data: null };
}

export async function approveExpansionRequest(requestId: string): Promise<ApiResponse<null>> {
  if (!(await requireAdmin())) return { ok: false, error: "Unauthorized." };

  const req = await db.groupTripExpansionRequest.findUnique({
    where: { id: requestId },
    include: { event: { select: { id: true, title: true, groupTripCapacity: true, seller: { select: { email: true, name: true } } } } },
  });
  if (!req) return { ok: false, error: "Request not found." };
  if (req.status !== "PENDING") return { ok: false, error: "Request already reviewed." };

  const newCapacity = (req.event.groupTripCapacity ?? 0) + req.requestedAdditional;

  await db.$transaction([
    db.groupTripExpansionRequest.update({
      where: { id: requestId },
      data: { status: "APPROVED", reviewedAt: new Date() },
    }),
    db.event.update({
      where: { id: req.event.id },
      data: { groupTripCapacity: newCapacity },
    }),
  ]);
  revalidatePath("/admin/group-trips");

  try {
    await sendGroupTripExpansionApprovedNotice({
      to: req.event.seller.email,
      sellerName: req.event.seller.name ?? "there",
      eventTitle: req.event.title,
      additionalSlots: req.requestedAdditional,
      newCapacity,
    });
  } catch (err) {
    console.error("[approveExpansionRequest] email failed:", err);
  }

  return { ok: true, data: null };
}

export async function rejectExpansionRequest(requestId: string, note: string): Promise<ApiResponse<null>> {
  if (!(await requireAdmin())) return { ok: false, error: "Unauthorized." };

  const req = await db.groupTripExpansionRequest.findUnique({
    where: { id: requestId },
    include: { event: { select: { title: true, seller: { select: { email: true, name: true } } } } },
  });
  if (!req) return { ok: false, error: "Request not found." };
  if (req.status !== "PENDING") return { ok: false, error: "Request already reviewed." };

  await db.groupTripExpansionRequest.update({
    where: { id: requestId },
    data: { status: "REJECTED", adminNote: note, reviewedAt: new Date() },
  });
  revalidatePath("/admin/group-trips");

  try {
    await sendGroupTripExpansionRejectedNotice({
      to: req.event.seller.email,
      sellerName: req.event.seller.name ?? "there",
      eventTitle: req.event.title,
      note,
    });
  } catch (err) {
    console.error("[rejectExpansionRequest] email failed:", err);
  }

  return { ok: true, data: null };
}
