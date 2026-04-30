import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: orderId } = await params;

  const order = await db.order.findFirst({
    where: { id: orderId, buyerId: session.user.id },
    include: {
      payments: { orderBy: { paymentNumber: "asc" } },
      ticketCategory: { include: { event: true } },
    },
  });

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.status !== "PARTIAL_PAID") {
    return NextResponse.json({ error: "No installment payment is due." }, { status: 400 });
  }

  const nextPayment = order.payments.find(
    (p) => p.paymentNumber > 0 && p.status === "PENDING"
  );
  if (!nextPayment) return NextResponse.json({ error: "No pending installment found." }, { status: 404 });

  return NextResponse.json({
    eventTitle: order.ticketCategory.event.title,
    eventDate: order.ticketCategory.event.date.toISOString(),
    venue: `${order.ticketCategory.event.venue}${order.ticketCategory.event.city ? `, ${order.ticketCategory.event.city}` : ""}`,
    categoryName: order.ticketCategory.name,
    installmentNumber: nextPayment.paymentNumber,
    amount: Number(nextPayment.amount),
    dueDate: nextPayment.dueDate.toISOString(),
    totalAmount: Number(order.totalAmount),
    paidAmount: Number(order.paidAmount),
  });
}
