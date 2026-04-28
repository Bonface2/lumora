import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { format } from "date-fns";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import type { OrderStatus } from "@prisma/client";

const statusVariant: Record<OrderStatus, "default" | "primary" | "success" | "warning" | "danger"> = {
  PENDING: "default",
  PARTIAL_PAID: "warning",
  PAID_IN_FULL: "success",
  DEFAULTED: "danger",
  REVOKED: "danger",
  CANCELLED: "default",
};

const statusLabel: Record<OrderStatus, string> = {
  PENDING: "Pending",
  PARTIAL_PAID: "Installments",
  PAID_IN_FULL: "Paid in full",
  DEFAULTED: "Defaulted",
  REVOKED: "Revoked",
  CANCELLED: "Cancelled",
};

export default async function BuyerTicketsPage() {
  const session = await auth();

  const orders = await db.order.findMany({
    where: {
      buyerId: session!.user.id,
      status: { notIn: ["PENDING", "CANCELLED"] },
    },
    include: {
      tickets: true,
      ticketCategory: { include: { event: true } },
      payments: { orderBy: { paymentNumber: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  const user = await db.user.findUnique({
    where: { id: session!.user.id },
    select: { name: true, email: true },
  });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Tickets</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {user?.name ?? user?.email} · {orders.length} ticket{orders.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/events"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Browse events
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-20 text-center">
          <svg className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
          </svg>
          <p className="mt-4 text-lg font-medium text-gray-900">No tickets yet</p>
          <p className="mt-1 text-sm text-gray-500">Browse events and grab your first ticket.</p>
          <Link
            href="/events"
            className="mt-4 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-700"
          >
            Browse events
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const event = order.ticketCategory.event;
            const pendingPayments = order.payments.filter(
              (p) => p.paymentNumber > 0 && p.status === "PENDING"
            );
            const nextPayment = pendingPayments[0];
            const paidAmount = Number(order.paidAmount);
            const totalAmount = Number(order.totalAmount);

            return (
              <div
                key={order.id}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-gray-900 truncate">{event.title}</h2>
                      <Badge variant={statusVariant[order.status]}>
                        {statusLabel[order.status]}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {format(event.date, "dd MMM yyyy · HH:mm")} · {event.venue}
                      {event.city ? `, ${event.city}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">{order.ticketCategory.name}</p>
                  </div>

                  {order.tickets.length > 0 && (
                    <div className="flex shrink-0 flex-col gap-1.5">
                      {order.tickets.map((t) => (
                        <div key={t.id} className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-center">
                          <p className="text-xs text-gray-500">Ticket</p>
                          <p className="mt-0.5 font-mono text-sm font-bold text-violet-700">
                            {t.ticketNumber}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {order.usesInstallments && (
                  <div className="mt-4 rounded-lg bg-gray-50 p-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                      <span>Payment progress</span>
                      <span>KES {paidAmount.toLocaleString()} / {totalAmount.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-200">
                      <div
                        className="h-1.5 rounded-full bg-violet-500"
                        style={{ width: `${Math.min(100, (paidAmount / totalAmount) * 100)}%` }}
                      />
                    </div>

                    {nextPayment && order.status === "PARTIAL_PAID" && (
                      <div className="mt-3 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-500">Next installment</p>
                          <p className="text-sm font-medium text-gray-900">
                            KES {Number(nextPayment.amount).toLocaleString()}
                            <span className="ml-1 text-xs font-normal text-gray-500">
                              due {format(nextPayment.dueDate, "dd MMM yyyy")}
                            </span>
                          </p>
                        </div>
                        <a
                          href={`/buyer/orders/${order.id}/pay`}
                          className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-700"
                        >
                          Pay now
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
