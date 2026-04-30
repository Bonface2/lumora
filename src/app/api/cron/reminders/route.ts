import { NextResponse } from "next/server";
import { format, addDays } from "date-fns";
import { db } from "@/lib/db";
import { sendInstallmentReminder } from "@/lib/email";

export const dynamic = "force-dynamic";

// Secured with a shared secret — set CRON_SECRET in your env vars.
// Call daily: GET /api/cron/reminders?secret=<CRON_SECRET>
// On Vercel, wire this up via vercel.json cron jobs.

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const windowEnd = addDays(now, 3); // remind for anything due within 3 days

  // Find all pending installments due within the reminder window that haven't
  // had a reminder sent yet.
  const payments = await db.installmentPayment.findMany({
    where: {
      status: "PENDING",
      dueDate: { lte: windowEnd },
      reminderSentAt: null,
    },
    include: {
      order: {
        include: {
          buyer: true,
          ticketCategory: { include: { event: true } },
        },
      },
    },
  });

  const results: { id: string; status: "sent" | "skipped" | "error"; reason?: string }[] = [];

  for (const payment of payments) {
    const { buyer, ticketCategory } = payment.order;
    const event = ticketCategory.event;

    // Skip orders that are no longer active
    if (!["PARTIAL_PAID"].includes(payment.order.status)) {
      results.push({ id: payment.id, status: "skipped", reason: `order status: ${payment.order.status}` });
      continue;
    }

    try {
      await sendInstallmentReminder({
        to: buyer.email,
        name: buyer.name ?? "there",
        eventTitle: event.title,
        amount: `KES ${Number(payment.amount).toLocaleString()}`,
        dueDate: format(payment.dueDate, "dd MMM yyyy"),
        paymentUrl: `${process.env.NEXT_PUBLIC_APP_URL}/buyer/orders/${payment.orderId}/pay`,
      });

      await db.installmentPayment.update({
        where: { id: payment.id },
        data: { reminderSentAt: new Date() },
      });

      results.push({ id: payment.id, status: "sent" });
    } catch (err) {
      results.push({ id: payment.id, status: "error", reason: String(err) });
    }
  }

  return NextResponse.json({
    processed: results.length,
    sent: results.filter((r) => r.status === "sent").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    errors: results.filter((r) => r.status === "error").length,
    results,
  });
}
