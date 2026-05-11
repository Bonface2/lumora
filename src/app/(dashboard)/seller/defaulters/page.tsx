import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { differenceInDays, format } from "date-fns";
import { Button } from "@/components/ui/Button";
import { RevokeButton } from "@/components/RevokeButton";
import { ExtendGracePeriodButton } from "@/components/ExtendGracePeriodButton";

const MS_PER_DAY = 86_400_000;

function calcRevocation(
  gracePeriodDays: number,
  payments: { status: string; dueDate: Date }[],
  orderStatus: string,
  now: Date
): { label: string; level: "terminal" | "critical" | "warning" | "none" } {
  if (orderStatus === "REVOKED") return { label: "Revoked", level: "terminal" };
  if (orderStatus === "DEFAULTED") return { label: "Defaulted", level: "critical" };

  const earliest = payments
    .filter((p) => p.status === "OVERDUE" || p.status === "DEFAULTED" || (p.status === "PENDING" && p.dueDate < now))
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];

  if (!earliest) return { label: "—", level: "none" };

  const revocationDate = new Date(earliest.dueDate.getTime() + gracePeriodDays * MS_PER_DAY);
  const days = Math.ceil((revocationDate.getTime() - now.getTime()) / MS_PER_DAY);

  if (days <= 0) return { label: "Revocation due", level: "critical" };
  if (days === 1) return { label: "1 day to revocation", level: "critical" };
  if (days <= 3) return { label: `${days} days to revocation`, level: "critical" };
  if (days <= 7) return { label: `${days} days to revocation`, level: "warning" };
  return { label: `${days} days to revocation`, level: "none" };
}

const levelStyles = {
  terminal: { border: "border-l-gray-400", badge: "bg-gray-100 text-gray-600", dot: "bg-gray-400" },
  critical: { border: "border-l-red-500", badge: "bg-red-100 text-red-700", dot: "bg-red-500" },
  warning:  { border: "border-l-amber-400", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  none:     { border: "border-l-orange-300", badge: "bg-orange-50 text-orange-600", dot: "bg-orange-300" },
};

export default async function DefaultersPage() {
  const session = await auth();
  const now = new Date();

  const orders = await db.order.findMany({
    where: {
      ticketCategory: { event: { sellerId: session!.user.id } },
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
    },
    include: {
      buyer: { select: { name: true, email: true, phone: true } },
      ticketCategory: {
        include: {
          event: { select: { title: true } },
          installmentPlan: { select: { gracePeriodDays: true, enforceRevocation: true } },
        },
      },
      payments: {
        where: { paymentNumber: { gt: 0 }, status: { in: ["PENDING", "OVERDUE", "DEFAULTED"] }, dueDate: { lt: now } },
        orderBy: { dueDate: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="min-h-full bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Defaulters</h1>
            <p className="mt-1 text-sm text-gray-500">
              {orders.length > 0
                ? `${orders.length} buyer${orders.length !== 1 ? "s" : ""} with overdue installment payments`
                : "Buyers with overdue installment payments"}
            </p>
          </div>
          {orders.length > 0 && (
            <div className="flex items-center gap-2">
              <a href="/api/seller/export?format=csv&defaulters=true" download>
                <Button variant="ghost" size="sm">
                  <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  CSV
                </Button>
              </a>
              <a href="/api/seller/export?format=xlsx&defaulters=true" download>
                <Button variant="ghost" size="sm">
                  <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Excel
                </Button>
              </a>
            </div>
          )}
        </div>

        {/* Empty state */}
        {orders.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
              <svg className="h-7 w-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="mt-4 text-base font-bold text-gray-900">No defaulters</p>
            <p className="mt-1 text-sm text-gray-500">All installment payments are up to date.</p>
          </div>
        )}

        {/* Cards */}
        <div className="space-y-4">
          {orders.map((order) => {
            const buyer = order.buyer;
            const event = order.ticketCategory.event;
            const grace = order.ticketCategory.installmentPlan?.gracePeriodDays ?? 7;
            const enforceRevocation = order.ticketCategory.installmentPlan?.enforceRevocation ?? false;
            const paid = Number(order.paidAmount);
            const total = Number(order.totalAmount);
            const balance = total - paid;
            const paidPct = Math.min(100, Math.round((paid / total) * 100));
            const earliestOverdue = order.payments[0];
            const daysOverdue = earliestOverdue ? differenceInDays(now, earliestOverdue.dueDate) : 0;
            const revocation = order.status === "REVOKED"
              ? { label: "Revoked", level: "terminal" as const }
              : !enforceRevocation
              ? { label: "Manual review", level: "none" as const }
              : calcRevocation(grace, order.payments, order.status, now);
            const styles = levelStyles[revocation.level];

            return (
              <div
                key={order.id}
                className={`rounded-2xl border border-gray-200 border-l-4 ${styles.border} bg-white overflow-hidden`}
              >
                {/* Card header */}
                <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate text-sm font-bold text-gray-900">{event.title}</span>
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                      {order.ticketCategory.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`h-2 w-2 rounded-full ${styles.dot}`} />
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles.badge}`}>
                      {revocation.label}
                    </span>
                  </div>
                </div>

                {/* Card body */}
                <div className="flex items-start gap-6 px-5 py-4">
                  {/* Left: buyer + progress */}
                  <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:gap-8">
                    {/* Buyer info */}
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Buyer</p>
                      <p className="font-semibold text-gray-900">{buyer.name ?? "—"}</p>
                      <a href={`mailto:${buyer.email}?subject=Payment reminder — ${event.title}&body=Hi ${buyer.name ?? ""},`}
                        className="block truncate text-sm text-primary-600 hover:underline">
                        {buyer.email}
                      </a>
                      {buyer.phone ? (
                        <a href={`tel:${buyer.phone}`} className="block text-sm text-gray-500 hover:underline">
                          {buyer.phone}
                        </a>
                      ) : (
                        <p className="text-sm text-gray-400">No phone</p>
                      )}
                    </div>

                    {/* Payment progress */}
                    <div className="w-full max-w-xs space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Payment progress</p>
                      <div className="flex items-end justify-between text-sm">
                        <span className="text-gray-500">Paid</span>
                        <span className="font-semibold text-gray-900">KES {paid.toLocaleString()}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-primary-500 transition-all"
                          style={{ width: `${paidPct}%` }}
                        />
                      </div>
                      <div className="flex items-end justify-between text-sm">
                        <span className="text-gray-500">Balance</span>
                        <span className="font-bold text-red-600">KES {balance.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: overdue details */}
                  <div className="shrink-0 space-y-2 text-right">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Overdue details</p>
                    <span className="inline-block rounded-lg bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700">
                      {daysOverdue} day{daysOverdue !== 1 ? "s" : ""} overdue
                    </span>
                    {earliestOverdue && (
                      <p className="text-xs text-gray-400">
                        Due {format(earliestOverdue.dueDate, "dd MMM yyyy")}
                      </p>
                    )}
                    <div className="flex justify-end gap-2 pt-1">
                      <a
                        href={`mailto:${buyer.email}?subject=Payment reminder — ${event.title}&body=Hi ${buyer.name ?? ""},`}
                        className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        Email
                      </a>
                      {buyer.phone && (
                        <a
                          href={`tel:${buyer.phone}`}
                          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          Call
                        </a>
                      )}
                      {order.status !== "REVOKED" && enforceRevocation && (
                        <ExtendGracePeriodButton orderId={order.id} buyerName={buyer.name ?? buyer.email} />
                      )}
                      {order.status !== "REVOKED" && (
                        <RevokeButton orderId={order.id} buyerName={buyer.name ?? buyer.email} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
