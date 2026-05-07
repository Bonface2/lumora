import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CancelOrderButton } from "./CancelOrderButton";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  PAID_IN_FULL: "bg-emerald-50 text-emerald-700",
  PARTIAL_PAID: "bg-amber-50 text-amber-700",
  PENDING: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-50 text-red-600",
  DEFAULTED: "bg-orange-50 text-orange-700",
  REVOKED: "bg-red-50 text-red-700",
};

function formatStatus(s: string) {
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/");

  const { status, search } = await searchParams;

  const orders = await db.order.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(search
        ? {
            OR: [
              { buyer: { name: { contains: search, mode: "insensitive" } } },
              { buyer: { email: { contains: search, mode: "insensitive" } } },
              { ticketCategory: { event: { title: { contains: search, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      totalAmount: true,
      paidAmount: true,
      status: true,
      usesInstallments: true,
      createdAt: true,
      buyer: { select: { name: true, email: true } },
      ticketCategory: {
        select: { name: true, event: { select: { title: true, date: true } } },
      },
    },
  });

  return (
    <div className="min-h-full bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-gray-900">Orders</h1>
          <p className="mt-1 text-sm text-gray-500">{orders.length} results</p>
        </div>

        {/* Filters */}
        <form method="get" className="mb-4 flex flex-wrap gap-3">
          <input
            name="search"
            defaultValue={search ?? ""}
            placeholder="Search buyer or event…"
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 w-64"
          />
          <select
            name="status"
            defaultValue={status ?? ""}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PARTIAL_PAID">Partial paid</option>
            <option value="PAID_IN_FULL">Paid in full</option>
            <option value="DEFAULTED">Defaulted</option>
            <option value="REVOKED">Revoked</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <button
            type="submit"
            className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
          >
            Filter
          </button>
          {(search || status) && (
            <a
              href="/admin/orders"
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 hover:border-gray-400 transition-colors"
            >
              Clear
            </a>
          )}
        </form>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-5 py-3 font-semibold text-gray-600">Buyer</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Event</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Status</th>
                <th className="px-5 py-3 font-semibold text-gray-600 text-right">Amount</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Date</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-gray-900">{o.buyer.name ?? "—"}</p>
                    <p className="text-xs text-gray-400">{o.buyer.email}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-gray-900 line-clamp-1">{o.ticketCategory.event.title}</p>
                    <p className="text-xs text-gray-400">{o.ticketCategory.name}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[o.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {formatStatus(o.status)}
                    </span>
                    {o.usesInstallments && (
                      <span className="ml-1.5 inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                        Installments
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <p className="font-semibold text-gray-900">KES {Number(o.totalAmount).toLocaleString()}</p>
                    {o.usesInstallments && Number(o.paidAmount) < Number(o.totalAmount) && (
                      <p className="text-xs text-gray-400">
                        KES {Number(o.paidAmount).toLocaleString()} paid
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-gray-500">
                    {new Date(o.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <CancelOrderButton orderId={o.id} status={o.status} />
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400">
                    No orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
