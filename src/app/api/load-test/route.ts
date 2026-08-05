import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { format } from "date-fns";
import { db } from "@/lib/db";
import {
  sendTicketConfirmation,
  sendInstallmentReceipt,
  sendBookingConfirmation,
} from "@/lib/email";

function generateTicketNumber(prefix: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(8);
  const random = Array.from(bytes, (b) => chars[b % chars.length]).join("");
  return `${prefix}-${random}`;
}

export async function POST(req: NextRequest) {
  if (process.env.LOAD_TEST_MODE !== "true") {
    return NextResponse.json({ ok: false, error: "Load test mode is disabled." }, { status: 403 });
  }

  const secret = req.headers.get("x-load-test-secret");
  if (!secret || secret !== process.env.LOAD_TEST_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.ticketCategoryId) {
    return NextResponse.json({ ok: false, error: "ticketCategoryId is required." }, { status: 400 });
  }

  const {
    ticketCategoryId,
    quantity: rawQty = 1,
    buyerEmail,
    useInstallments = false,
  } = body as {
    ticketCategoryId: string;
    quantity?: number;
    buyerEmail?: string;
    useInstallments?: boolean;
  };

  const quantity = Math.max(1, Math.min(10, Number(rawQty)));

  const category = await db.ticketCategory.findUnique({
    where: { id: ticketCategoryId },
    include: {
      event: true,
      installmentPlan: {
        include: { scheduleItems: { orderBy: { installmentNumber: "asc" } } },
      },
    },
  });

  if (!category) return NextResponse.json({ ok: false, error: "Category not found." }, { status: 404 });
  if (category.event.status !== "PUBLISHED") {
    return NextResponse.json({ ok: false, error: "Event is not published." }, { status: 400 });
  }

  const email = buyerEmail || "load-test@lumora.internal";
  const buyer = await db.user.upsert({
    where: { email },
    create: { email, name: email.split("@")[0], role: "BUYER" },
    update: {},
  });

  const prefix = category.event.title.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "X");
  const totalAmount = Number(category.price) * quantity;
  const isGroupTrip = category.event.experienceType === "GROUP_TRIP";
  const wantsInstallments = useInstallments && category.allowInstallments && !!category.installmentPlan;
  const ticketNumbers: string[] = [];
  let orderId: string | null = null;

  const eventDate = format(category.event.date, "EEEE, dd MMMM yyyy · HH:mm");
  const venue = `${category.event.venue}${category.event.city ? `, ${category.event.city}` : ""}`;

  try {
    if (wantsInstallments) {
      const plan = category.installmentPlan!;
      const now = new Date();
      const pastDuePct = plan.scheduleItems
        .filter((s) => s.dueDate <= now)
        .reduce((sum, s) => sum + Number(s.percentage), 0);
      const initialPercent = Number(plan.initialPaymentPercent) + pastDuePct;
      const initialAmount = Math.round((totalAmount * initialPercent) / 100);
      const futureItems = plan.scheduleItems.filter((s) => s.dueDate > now);

      await db.$transaction(async (tx) => {
        const reserved = await tx.$executeRaw`
          UPDATE "TicketCategory"
          SET "soldQuantity" = "soldQuantity" + ${quantity}
          WHERE id = ${ticketCategoryId} AND "soldQuantity" + ${quantity} <= "totalQuantity"
        `;
        if (reserved === 0) throw new Error("SOLD_OUT");

        const order = await tx.order.create({
          data: {
            buyerId: buyer.id,
            ticketCategoryId,
            quantity,
            totalAmount,
            paidAmount: initialAmount,
            status: "PARTIAL_PAID",
            usesInstallments: true,
          },
        });
        orderId = order.id;

        await tx.installmentPayment.create({
          data: {
            orderId: order.id,
            paymentNumber: 0,
            amount: initialAmount,
            dueDate: now,
            status: "PAID",
            paidAt: now,
            paidAmount: initialAmount,
          },
        });

        for (const item of futureItems) {
          await tx.installmentPayment.create({
            data: {
              orderId: order.id,
              installmentScheduleItemId: item.id,
              paymentNumber: item.installmentNumber,
              amount: Math.round((totalAmount * Number(item.percentage)) / 100),
              dueDate: item.dueDate,
              status: "PENDING",
            },
          });
        }

        if (!isGroupTrip) {
          for (let i = 0; i < quantity; i++) {
            const num = generateTicketNumber(prefix);
            ticketNumbers.push(num);
            await tx.ticket.create({
              data: { orderId: order.id, ticketCategoryId, ticketNumber: num, status: "ACTIVE", currentOwnerId: buyer.id },
            });
          }
        }
      });

      const remainingPayments = futureItems.map((item) => ({
        installmentNumber: item.installmentNumber,
        amount: Math.round((totalAmount * Number(item.percentage)) / 100),
        dueDate: format(item.dueDate, "dd MMM yyyy"),
      }));

      if (isGroupTrip) {
        await sendBookingConfirmation({
          to: buyer.email, name: buyer.name ?? buyer.email,
          eventTitle: category.event.title, categoryName: category.name,
          quantity, totalAmount, paidAmount: initialAmount, eventDate, venue,
        });
      } else {
        await sendInstallmentReceipt({
          to: buyer.email, name: buyer.name ?? buyer.email,
          eventTitle: category.event.title, categoryName: category.name,
          eventDate, venue, amountPaid: initialAmount, totalPaid: initialAmount,
          totalAmount, remainingPayments, isDeposit: true,
        });
      }
    } else {
      await db.$transaction(async (tx) => {
        const reserved = await tx.$executeRaw`
          UPDATE "TicketCategory"
          SET "soldQuantity" = "soldQuantity" + ${quantity}
          WHERE id = ${ticketCategoryId} AND "soldQuantity" + ${quantity} <= "totalQuantity"
        `;
        if (reserved === 0) throw new Error("SOLD_OUT");

        const order = await tx.order.create({
          data: {
            buyerId: buyer.id,
            ticketCategoryId,
            quantity,
            totalAmount,
            paidAmount: totalAmount,
            status: "PAID_IN_FULL",
            usesInstallments: false,
          },
        });
        orderId = order.id;

        await tx.installmentPayment.create({
          data: {
            orderId: order.id,
            paymentNumber: 0,
            amount: totalAmount,
            dueDate: new Date(),
            status: "PAID",
            paidAt: new Date(),
            paidAmount: totalAmount,
          },
        });

        for (let i = 0; i < quantity; i++) {
          const num = generateTicketNumber(prefix);
          ticketNumbers.push(num);
          await tx.ticket.create({
            data: { orderId: order.id, ticketCategoryId, ticketNumber: num, status: "ACTIVE", currentOwnerId: buyer.id },
          });
        }
      });

      if (isGroupTrip) {
        await sendBookingConfirmation({
          to: buyer.email, name: buyer.name ?? buyer.email,
          eventTitle: category.event.title, categoryName: category.name,
          quantity, totalAmount, paidAmount: totalAmount, eventDate, venue,
        });
      } else {
        await sendTicketConfirmation({
          to: buyer.email, name: buyer.name ?? buyer.email,
          eventTitle: category.event.title, categoryName: category.name,
          ticketNumbers, eventDate, venue,
        });
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message === "SOLD_OUT") {
      return NextResponse.json({ ok: false, error: "Sold out." }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({
    ok: true,
    orderId,
    ticketNumbers,
    type: wantsInstallments ? "installment" : "full",
  });
}
