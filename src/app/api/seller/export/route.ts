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

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SELLER") {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") ?? "xlsx";
  const defaultersOnly = searchParams.get("defaulters") === "true";

  const now = new Date();

  const orders = await db.order.findMany({
    where: {
      ticketCategory: {
        event: { sellerId: session.user.id },
      },
      NOT: { status: "PENDING" },
      ...(defaultersOnly
        ? {
            OR: [
              { status: { in: ["DEFAULTED", "REVOKED"] } },
              {
                status: "PARTIAL_PAID",
                payments: {
                  some: {
                    paymentNumber: { gt: 0 },
                    dueDate: { lt: now },
                    status: { in: ["PENDING", "OVERDUE", "DEFAULTED"] },
                  },
                },
              },
            ],
          }
        : {}),
    },
    include: {
      buyer: { select: { name: true, email: true, phone: true } },
      ticketCategory: {
        select: {
          name: true,
          event: { select: { title: true } },
          installmentPlan: { select: { gracePeriodDays: true } },
        },
      },
      payments: {
        select: { status: true, dueDate: true },
        orderBy: { dueDate: "asc" },
      },
    },
    orderBy: [
      { ticketCategory: { event: { title: "asc" } } },
      { createdAt: "asc" },
    ],
  });

  const rows = orders.map((o) => {
    const totalAmount = Number(o.totalAmount);
    const paidAmount = Number(o.paidAmount);

    const hasOverduePayment = o.payments.some(
      (p) =>
        p.status === "OVERDUE" ||
        p.status === "DEFAULTED" ||
        (p.status === "PENDING" && p.dueDate < now)
    );
    const isDefaulter =
      o.status === "DEFAULTED" ||
      o.status === "REVOKED" ||
      hasOverduePayment;

    return {
      "Event": o.ticketCategory.event.title,
      "Name": o.buyer.name ?? "",
      "Email": o.buyer.email,
      "Phone": o.buyer.phone ?? "",
      "Ticket Category": o.ticketCategory.name,
      "Payment Plan": o.usesInstallments ? "Installments" : "Full",
      "Amount Paid (KES)": paidAmount,
      "Balance (KES)": totalAmount - paidAmount,
      "Order Status": o.status,
      "Defaulter": isDefaulter ? "Yes" : "No",
      "Days to Revocation": calcDaysToRevocation(o, now),
    };
  });

  const filename = defaultersOnly ? "defaulters" : "all_attendees";

  if (format === "csv") {
    const ws = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  }

  const wb = XLSX.utils.book_new();
  const sheetName = defaultersOnly ? "Defaulters" : "All Attendees";
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName);

  // Summary sheet (per event)
  if (!defaultersOnly) {
    const eventMap = new Map<
      string,
      { collected: number; outstanding: number; defaulters: number; total: number }
    >();
    for (const o of orders) {
      const title = o.ticketCategory.event.title;
      const entry = eventMap.get(title) ?? {
        collected: 0,
        outstanding: 0,
        defaulters: 0,
        total: 0,
      };
      entry.collected += Number(o.paidAmount);
      entry.outstanding += Number(o.totalAmount) - Number(o.paidAmount);
      entry.total += 1;
      const hasOverdue = o.payments.some(
        (p) =>
          p.status === "OVERDUE" ||
          p.status === "DEFAULTED" ||
          (p.status === "PENDING" && p.dueDate < now)
      );
      if (o.status === "DEFAULTED" || o.status === "REVOKED" || hasOverdue) {
        entry.defaulters += 1;
      }
      eventMap.set(title, entry);
    }

    const summaryRows = Array.from(eventMap.entries()).map(([title, s]) => ({
      "Event": title,
      "Total Orders": s.total,
      "Collected (KES)": s.collected,
      "Outstanding (KES)": s.outstanding,
      "Defaulters": s.defaulters,
    }));

    if (summaryRows.length > 0) {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(summaryRows),
        "Summary"
      );
    }
  }

  const raw: Uint8Array = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const blob = new Blob([Buffer.from(raw)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  return new Response(blob, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}_export.xlsx"`,
    },
  });
}
