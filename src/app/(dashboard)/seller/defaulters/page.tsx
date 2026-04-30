import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { differenceInDays } from "date-fns";
import { Button } from "@/components/ui/Button";

const MS_PER_DAY = 86_400_000;

function calcDaysToRevocation(
  gracePeriodDays: number,
  payments: { status: string; dueDate: Date }[],
  orderStatus: string,
  now: Date
): { label: string; urgent: boolean } {
  if (orderStatus === "REVOKED") return { label: "Revoked", urgent: true };
  if (orderStatus === "DEFAULTED") return { label: "Defaulted", urgent: true };

  const earliest = payments
    .filter(
      (p) =>
        p.status === "OVERDUE" ||
        p.status === "DEFAULTED" ||
        (p.status === "PENDING" && p.dueDate < now)
    )
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];

  if (!earliest) return { label: "—", urgent: false };

  const revocationDate = new Date(
    earliest.dueDate.getTime() + gracePeriodDays * MS_PER_DAY
  );
  const days = Math.ceil((revocationDate.getTime() - now.getTime()) / MS_PER_DAY);

  if (days <= 0) return { label: "Due now", urgent: true };
  if (days <= 3) return { label: `${days} day${days !== 1 ? "s" : ""}`, urgent: true };
  return { label: `${days} days`, urgent: false };
}

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
          installmentPlan: { select: { gracePeriodDays: true } },
        },
      },
      payments: {
        where: {
          paymentNumber: { gt: 0 },
          status: { in: ["PENDING", "OVERDUE", "DEFAULTED"] },
          dueDate: { lt: now },
        },
        orderBy: { dueDate: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Defaulters</h1>
          <p className="mt-1 text-sm text-gray-500">
            Buyers with overdue installment payments
          </p>
        </div>
        {orders.length > 0 && (
          <div className="flex items-center gap-2">
            <a href="/api/seller/export?format=csv&defaulters=true" download>
              <Button variant="ghost" size="sm">
                <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                CSV
              </Button>
            </a>
            <a href="/api/seller/export?format=xlsx&defaulters=true" download>
              <Button variant="ghost" size="sm">
                <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Excel
              </Button>
            </a>
          </div>
        )}
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-20 text-center">
          <svg className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="mt-4 text-lg font-medium text-gray-900">No defaulters</p>
          <p className="mt-1 text-sm text-gray-500">All installment payments are up to date.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {[
                  "Event",
                  "Name",
                  "Email",
                  "Phone",
                  "Category",
                  "Payment Plan",
                  "Amt Paid (KES)",
                  "Balance (KES)",
                  "Days Overdue",
                  "Days to Revocation",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order) => {
                const buyer = order.buyer;
                const event = order.ticketCategory.event;
                const grace =
                  order.ticketCategory.installmentPlan?.gracePeriodDays ?? 7;
                const paidAmount = Number(order.paidAmount);
                const balance =
                  Number(order.totalAmount) - paidAmount;
                const earliestOverdue = order.payments[0];
                const daysOverdue = earliestOverdue
                  ? differenceInDays(now, earliestOverdue.dueDate)
                  : 0;
                const revocation = calcDaysToRevocation(
                  grace,
                  order.payments,
                  order.status,
                  now
                );

                return (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                      {event.title}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {buyer.name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <a
                        href={`mailto:${buyer.email}`}
                        className="text-primary-600 hover:underline"
                      >
                        {buyer.email}
                      </a>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                      {buyer.phone ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                      {order.ticketCategory.name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                      Installments
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-900">
                      {paidAmount.toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-red-600">
                      {balance.toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        {daysOverdue} day{daysOverdue !== 1 ? "s" : ""}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          revocation.urgent
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {revocation.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-2">
                        <a
                          href={`mailto:${buyer.email}?subject=Payment reminder — ${event.title}&body=Hi ${buyer.name ?? ""},`}
                          title="Email buyer"
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-primary-600"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </a>
                        {buyer.phone && (
                          <a
                            href={`tel:${buyer.phone}`}
                            title="Call buyer"
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-primary-600"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
