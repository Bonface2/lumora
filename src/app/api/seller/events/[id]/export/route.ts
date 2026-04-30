import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

const MS_PER_DAY = 86_400_000;

function calcDaysToRevocation(
  order: {
    status: string;
    usesInstallments: boolean;
    payments: { status: string; dueDate: Date }[];
    ticketCategory: { installmentPlan: { gracePeriodDays: number } | null };
  },
  now: Date
): string {
  if (!order.usesInstallments) return "—";
  if (order.status === "REVOKED") return "Revoked";
  if (order.status === "DEFAULTED") return "Defaulted";

  const grace = order.ticketCategory.installmentPlan?.gracePeriodDays ?? 7;
  const earliest = order.payments
    .filter(
      (p) =>
        p.status === "OVERDUE" ||
        p.status === "DEFAULTED" ||
        (p.status === "PENDING" && p.dueDate < now)
    )
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];

  if (!earliest) return "—";

  const revocationDate = new Date(earliest.dueDate.getTime() + grace * MS_PER_DAY);
  const days = Math.ceil((revocationDate.getTime() - now.getTime()) / MS_PER_DAY);
  return days > 0 ? `${days} day${days !== 1 ? "s" : ""}` : "Due now";
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: eventId } = await params;

  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const event = await db.event.findFirst({
    where: { id: eventId, sellerId: session.user.id },
    select: { id: true, title: true },
  });
  if (!event) return new Response("Not found", { status: 404 });

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") ?? "xlsx"; // "xlsx" | "csv"

  const [tickets, orders, installmentPayments] = await Promise.all([
    db.ticket.findMany({
      where: { order: { ticketCategory: { eventId } } },
      include: {
        order: {
          include: {
            buyer: { select: { name: true, email: true, phone: true } },
            ticketCategory: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.order.findMany({
      where: { ticketCategory: { eventId } },
      include: {
        buyer: { select: { name: true, email: true, phone: true } },
        ticketCategory: {
          select: {
            name: true,
            installmentPlan: { select: { gracePeriodDays: true } },
          },
        },
        payments: {
          select: { status: true, dueDate: true },
          orderBy: { dueDate: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.installmentPayment.findMany({
      where: { order: { ticketCategory: { eventId } } },
      include: {
        order: {
          include: {
            buyer: { select: { name: true, email: true, phone: true } },
            ticketCategory: { select: { name: true } },
          },
        },
      },
      orderBy: [{ orderId: "asc" }, { paymentNumber: "asc" }],
    }),
  ]);

  const attendeeRows = tickets.map((t) => ({
    "Ticket #": t.ticketNumber,
    "Name": t.order.buyer.name ?? "",
    "Email": t.order.buyer.email,
    "Phone": t.order.buyer.phone ?? "",
    "Category": t.order.ticketCategory.name,
    "Status": t.status,
    "Checked In": t.checkedInAt
      ? new Date(t.checkedInAt).toLocaleString("en-KE")
      : "No",
  }));

  const now = new Date();

  const orderRows = orders.map((o) => ({
    "Order ID": o.id,
    "Name": o.buyer.name ?? "",
    "Email": o.buyer.email,
    "Phone": o.buyer.phone ?? "",
    "Category": o.ticketCategory.name,
    "Qty": o.quantity,
    "Payment Plan": o.usesInstallments ? "Installments" : "Full",
    "Total (KES)": Number(o.totalAmount),
    "Paid (KES)": Number(o.paidAmount),
    "Balance (KES)": Number(o.totalAmount) - Number(o.paidAmount),
    "Status": o.status,
    "Days to Revocation": calcDaysToRevocation(o, now),
    "Date": new Date(o.createdAt).toLocaleString("en-KE"),
  }));

  const installmentRows = installmentPayments.map((p) => ({
    "Order ID": p.orderId,
    "Name": p.order.buyer.name ?? "",
    "Email": p.order.buyer.email,
    "Phone": p.order.buyer.phone ?? "",
    "Category": p.order.ticketCategory.name,
    "Payment #": p.paymentNumber,
    "Amount (KES)": Number(p.amount),
    "Due Date": new Date(p.dueDate).toLocaleDateString("en-KE"),
    "Paid Date": p.paidAt ? new Date(p.paidAt).toLocaleDateString("en-KE") : "",
    "Status": p.status,
  }));

  const safeTitle = event.title.replace(/[^a-z0-9]+/gi, "_").toLowerCase();

  if (format === "csv") {
    const ws = XLSX.utils.json_to_sheet(attendeeRows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeTitle}_attendees.csv"`,
      },
    });
  }

  // Multi-sheet Excel
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(attendeeRows), "Attendees");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(orderRows), "Orders");
  if (installmentRows.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(installmentRows),
      "Installments"
    );
  }

  const raw: Uint8Array = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const blob = new Blob([Buffer.from(raw)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  return new Response(blob, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeTitle}_export.xlsx"`,
    },
  });
}
