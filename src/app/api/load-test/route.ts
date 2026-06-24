import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";

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

  const { ticketCategoryId, quantity: rawQty = 1 } = body as {
    ticketCategoryId: string;
    quantity?: number;
  };
  const quantity = Math.max(1, Math.min(10, Number(rawQty)));

  const category = await db.ticketCategory.findUnique({
    where: { id: ticketCategoryId },
    include: { event: true },
  });

  if (!category) return NextResponse.json({ ok: false, error: "Category not found." }, { status: 404 });
  if (category.event.status !== "PUBLISHED") {
    return NextResponse.json({ ok: false, error: "Event is not published." }, { status: 400 });
  }

  // Find or create a stable test buyer
  const buyerEmail = "load-test@lumora.internal";
  const buyer = await db.user.upsert({
    where: { email: buyerEmail },
    create: { email: buyerEmail, name: "Load Test Bot", role: "BUYER" },
    update: {},
  });

  const prefix = category.event.title.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "X");
  const ticketNumbers: string[] = [];
  let orderId: string | null = null;

  try {
    await db.$transaction(async (tx) => {
      // Atomic reserve — same guard used by the real purchase flow
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
          totalAmount: Number(category.price) * quantity,
          paidAmount: Number(category.price) * quantity,
          status: "PAID_IN_FULL",
          usesInstallments: false,
        },
      });
      orderId = order.id;

      await tx.installmentPayment.create({
        data: {
          orderId: order.id,
          paymentNumber: 0,
          amount: Number(category.price) * quantity,
          dueDate: new Date(),
          status: "PAID",
        },
      });

      for (let i = 0; i < quantity; i++) {
        const num = generateTicketNumber(prefix);
        ticketNumbers.push(num);
        await tx.ticket.create({
          data: {
            orderId: order.id,
            ticketCategoryId,
            ticketNumber: num,
            status: "ACTIVE",
            currentOwnerId: buyer.id,
          },
        });
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message === "SOLD_OUT") {
      return NextResponse.json({ ok: false, error: "Sold out." }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({ ok: true, orderId, ticketNumbers });
}
