import { db } from "@/lib/db";
import { PLATFORM_FEE_PERCENT } from "@/lib/paystack";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const events = await db.event.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      seller: { select: { name: true, email: true } },
      _count: { select: { ticketCategories: true } },
    },
  });

  return (
    <div className="min-h-full bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-gray-900">Events</h1>
          <p className="mt-1 text-sm text-gray-500">
            Set a custom platform fee for any event. Leave blank to use the global default ({PLATFORM_FEE_PERCENT}%).
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-5 py-3 font-semibold text-gray-600">Event</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Seller</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Status</th>
                <th className="px-5 py-3 font-semibold text-gray-600 text-right">Platform fee</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.map((event) => {
                const fee = event.platformFeePercent !== null
                  ? `${Number(event.platformFeePercent)}%`
                  : `${PLATFORM_FEE_PERCENT}% (default)`;
                const isCustom = event.platformFeePercent !== null;

                return (
                  <tr key={event.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-900">{event.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(event.date).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                        {" · "}
                        {event.venue}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      <p>{event.seller.name ?? "—"}</p>
                      <p className="text-xs text-gray-400">{event.seller.email}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        event.status === "PUBLISHED"
                          ? "bg-emerald-50 text-emerald-700"
                          : event.status === "DRAFT"
                          ? "bg-gray-100 text-gray-600"
                          : "bg-red-50 text-red-700"
                      }`}>
                        {event.status.charAt(0) + event.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className={`font-semibold ${isCustom ? "text-primary-600" : "text-gray-400"}`}>
                        {fee}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <a
                        href={`/admin/events/${event.id}`}
                        className="text-sm font-semibold text-primary-600 hover:underline"
                      >
                        Edit fee
                      </a>
                    </td>
                  </tr>
                );
              })}
              {events.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400">
                    No events yet.
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
