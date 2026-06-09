import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PAID_IN_FULL:  "Paid in Full",
  PARTIAL_PAID:  "Partial",
  DEFAULTED:     "Defaulted",
  REVOKED:       "Revoked",
  CANCELLED:     "Cancelled",
  PENDING:       "Pending",
};

// ── Lumora brand colours (ARGB) ────────────────────────────────────────────
const C = {
  primary900: "FF134A4D",
  primary800: "FF115E61",
  primary700: "FF0D7A7D",
  primary600: "FF0F9699",
  primary500: "FF16B5B8",
  primary100: "FFCCFAFB",
  primary50:  "FFF0FDFC",
  white:      "FFFFFFFF",
  gray900:    "FF111827",
  gray500:    "FF6B7280",
  gray50:     "FFF9FAFB",
} as const;

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

// ── Helpers ────────────────────────────────────────────────────────────────

function headerFill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function solidFill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function applyTitleRow(
  sheet: ExcelJS.Worksheet,
  title: string,
  colCount: number
) {
  sheet.insertRow(1, [title]);
  const cell = sheet.getCell("A1");
  cell.value = title;
  cell.fill = headerFill(C.white);
  cell.font = { name: "Calibri", size: 18, bold: true, color: { argb: C.primary800 } };
  cell.alignment = { vertical: "middle", horizontal: "center" };
  sheet.mergeCells(1, 1, 1, colCount);
  sheet.getRow(1).height = 36;
}

function applyHeaderRow(sheet: ExcelJS.Worksheet, rowNumber: number) {
  const row = sheet.getRow(rowNumber);
  row.height = 22;
  row.eachCell((cell) => {
    cell.fill = headerFill(C.primary600);
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: C.white } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: false };
    cell.border = {
      bottom: { style: "medium", color: { argb: C.primary700 } },
    };
  });
  row.commit();
}

function applyDataRow(sheet: ExcelJS.Worksheet, rowNumber: number, isEven: boolean) {
  const row = sheet.getRow(rowNumber);
  row.height = 16;
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = solidFill(isEven ? C.primary50 : C.white);
    cell.font = { name: "Calibri", size: 10, color: { argb: C.gray900 } };
    cell.alignment = { vertical: "middle" };
  });
}

function setColWidths(sheet: ExcelJS.Worksheet, widths: number[]) {
  widths.forEach((width, i) => {
    sheet.getColumn(i + 1).width = width;
    sheet.getColumn(i + 1).font = { name: "Calibri", size: 10 };
  });
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SELLER") {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") ?? "xlsx";
  const defaultersOnly = searchParams.get("defaulters") === "true";
  const eventIds = searchParams.getAll("event").filter(Boolean);

  const now = new Date();

  const orders = await db.order.findMany({
    where: {
      ticketCategory: {
        event: {
          sellerId: session.user.id,
          ...(eventIds.length > 0 ? { id: { in: eventIds } } : {}),
        },
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
      event: o.ticketCategory.event.title,
      name: o.buyer.name ?? "",
      email: o.buyer.email,
      phone: o.buyer.phone ?? "",
      ticketCategory: o.ticketCategory.name,
      paymentPlan: o.usesInstallments ? "Installments" : "Full",
      totalAmount,
      paidAmount,
      balance: totalAmount - paidAmount,
      status: STATUS_LABEL[o.status] ?? o.status,
      defaulter: isDefaulter ? "Yes" : "No",
      daysToRevocation: calcDaysToRevocation(o, now),
    };
  });

  const filename = defaultersOnly ? "defaulters" : "all_attendees";

  // ── CSV (plain, no styling) ──────────────────────────────────────────────
  if (format === "csv") {
    const csvRows = rows.map((r) => ({
      "Event": r.event,
      "Name": r.name,
      "Email": r.email,
      "Phone": r.phone,
      "Ticket Category": r.ticketCategory,
      "Payment Plan": r.paymentPlan,
      "Total Amount (KES)": r.totalAmount,
      "Amount Paid (KES)": r.paidAmount,
      "Balance (KES)": r.balance,
      "Order Status": r.status,
      "Defaulter": r.defaulter,
      "Days to Revocation": r.daysToRevocation,
    }));
    const ws = XLSX.utils.json_to_sheet(csvRows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  }

  // ── XLSX (styled) ────────────────────────────────────────────────────────
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Lumora";
  workbook.created = now;

  const sheetTitle = defaultersOnly ? "Defaulters" : "All Attendees";
  const sheet = workbook.addWorksheet(sheetTitle, {
    views: [{ state: "frozen", ySplit: 2 }],
    pageSetup: { fitToPage: true, fitToWidth: 1 },
  });

  // Column definitions (header + key + width)
  const columns: ExcelJS.Column[] = [
    { header: "Event",              key: "event",             width: 32 },
    { header: "Name",               key: "name",              width: 22 },
    { header: "Email",              key: "email",             width: 28 },
    { header: "Phone",              key: "phone",             width: 16 },
    { header: "Ticket Category",    key: "ticketCategory",    width: 20 },
    { header: "Payment Plan",       key: "paymentPlan",       width: 16 },
    { header: "Total Amount (KES)", key: "totalAmount",       width: 20 },
    { header: "Amount Paid (KES)",  key: "paidAmount",        width: 20 },
    { header: "Balance (KES)",      key: "balance",           width: 16 },
    { header: "Order Status",       key: "status",            width: 16 },
    { header: "Defaulter",          key: "defaulter",         width: 12 },
    { header: "Days to Revocation", key: "daysToRevocation",  width: 20 },
  ] as ExcelJS.Column[];
  sheet.columns = columns;

  const colCount = columns.length;
  const numberFmt = '#,##0.00';

  // Title row
  applyTitleRow(sheet, `Lumora — ${sheetTitle} Export`, colCount);

  // Header row is now row 2 (title pushed it down)
  applyHeaderRow(sheet, 2);

  // Data rows start at row 3
  rows.forEach((r, i) => {
    const row = sheet.addRow(r);
    applyDataRow(sheet, row.number, i % 2 === 0);

    // Right-align + number format for KES columns
    (["totalAmount", "paidAmount", "balance"] as const).forEach((key) => {
      const col = sheet.getColumn(key);
      const cell = row.getCell(col.number);
      cell.alignment = { vertical: "middle", horizontal: "right" };
      cell.numFmt = numberFmt;
    });

    // Centre-align short columns
    (["paymentPlan", "status", "defaulter", "daysToRevocation"] as const).forEach((key) => {
      const col = sheet.getColumn(key);
      row.getCell(col.number).alignment = { vertical: "middle", horizontal: "center" };
    });
  });

  // Re-align header number columns to center
  (["totalAmount", "paidAmount", "balance"] as const).forEach((key) => {
    const col = sheet.getColumn(key);
    sheet.getRow(2).getCell(col.number).alignment = { vertical: "middle", horizontal: "center" };
  });

  setColWidths(sheet, columns.map((c) => (c.width as number) ?? 14));

  // ── Summary sheet ─────────────────────────────────────────────────────────
  if (!defaultersOnly) {
    const eventMap = new Map<
      string,
      { collected: number; outstanding: number; total: number; defaulters: number; totalAmount: number }
    >();
    for (const o of orders) {
      const title = o.ticketCategory.event.title;
      const entry = eventMap.get(title) ?? {
        collected: 0, outstanding: 0, total: 0, defaulters: 0, totalAmount: 0,
      };
      const ta = Number(o.totalAmount);
      const pa = Number(o.paidAmount);
      entry.totalAmount += ta;
      entry.collected += pa;
      entry.outstanding += ta - pa;
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

    if (eventMap.size > 0) {
      const summarySheet = workbook.addWorksheet("Summary", {
        views: [{ state: "frozen", ySplit: 2 }],
      });

      const sumCols: ExcelJS.Column[] = [
        { header: "Event",               key: "event",       width: 36 },
        { header: "Total Orders",        key: "total",       width: 16 },
        { header: "Total Amount (KES)",  key: "totalAmount", width: 20 },
        { header: "Collected (KES)",     key: "collected",   width: 20 },
        { header: "Outstanding (KES)",   key: "outstanding", width: 20 },
        { header: "Defaulters",          key: "defaulters",  width: 14 },
      ] as ExcelJS.Column[];
      summarySheet.columns = sumCols;

      applyTitleRow(summarySheet, "Lumora — Summary by Event", sumCols.length);
      applyHeaderRow(summarySheet, 2);

      const summaryRows = Array.from(eventMap.entries()).map(([title, s]) => ({
        event: title,
        total: s.total,
        totalAmount: s.totalAmount,
        collected: s.collected,
        outstanding: s.outstanding,
        defaulters: s.defaulters,
      }));

      summaryRows.forEach((r, i) => {
        const row = summarySheet.addRow(r);
        applyDataRow(summarySheet, row.number, i % 2 === 0);
        (["totalAmount", "collected", "outstanding"] as const).forEach((key) => {
          const col = summarySheet.getColumn(key);
          const cell = row.getCell(col.number);
          cell.alignment = { vertical: "middle", horizontal: "right" };
          cell.numFmt = numberFmt;
        });
        (["total", "defaulters"] as const).forEach((key) => {
          summarySheet.getColumn(key);
          row.getCell(summarySheet.getColumn(key).number).alignment = { vertical: "middle", horizontal: "center" };
        });
      });

      // Totals row
      const totals = summaryRows.reduce(
        (acc, r) => ({
          total: acc.total + r.total,
          totalAmount: acc.totalAmount + r.totalAmount,
          collected: acc.collected + r.collected,
          outstanding: acc.outstanding + r.outstanding,
          defaulters: acc.defaulters + r.defaulters,
        }),
        { total: 0, totalAmount: 0, collected: 0, outstanding: 0, defaulters: 0 }
      );

      const totalsRow = summarySheet.addRow({
        event: "TOTAL",
        ...totals,
      });
      totalsRow.height = 18;
      totalsRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = solidFill(C.primary100);
        cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: C.primary800 } };
        cell.border = { top: { style: "thin", color: { argb: C.primary600 } } };
        cell.alignment = { vertical: "middle" };
      });
      (["totalAmount", "collected", "outstanding"] as const).forEach((key) => {
        const col = summarySheet.getColumn(key);
        const cell = totalsRow.getCell(col.number);
        cell.alignment = { vertical: "middle", horizontal: "right" };
        cell.numFmt = numberFmt;
      });
      (["total", "defaulters"] as const).forEach((key) => {
        totalsRow.getCell(summarySheet.getColumn(key).number).alignment = { vertical: "middle", horizontal: "center" };
      });

      setColWidths(summarySheet, sumCols.map((c) => (c.width as number) ?? 14));
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}_export.xlsx"`,
    },
  });
}
