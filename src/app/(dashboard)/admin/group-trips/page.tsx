import { format } from "date-fns";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPendingGroupTrips, getPendingExpansionRequests } from "@/app/actions/admin";
import {
  ApproveGroupTripButton,
  RejectGroupTripButton,
  ApproveExpansionButton,
  RejectExpansionButton,
} from "./GroupTripActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Group trip reviews — Admin" };

export default async function AdminGroupTripsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/login");

  const [pendingTrips, expansionRequests] = await Promise.all([
    getPendingGroupTrips(),
    getPendingExpansionRequests(),
  ]);

  return (
    <div className="min-h-full bg-gray-50 font-sans">
      {/* Header */}
      <div className="bg-gray-800 px-8 py-8">
        <p className="text-xs font-bold uppercase tracking-widest text-primary-400 mb-1">Admin</p>
        <h1 className="text-2xl font-black text-white">Group trip reviews</h1>
        <p className="mt-1 text-sm text-gray-400">
          Review and approve group trips exceeding the auto-approve threshold, and expansion requests.
        </p>
      </div>

      <div className="p-8 space-y-10">
        {/* ── Pending group trips ── */}
        <section>
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Pending approval</h2>
            {pendingTrips.length > 0 && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                {pendingTrips.length}
              </span>
            )}
          </div>

          {pendingTrips.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center">
              <p className="text-sm font-semibold text-gray-500">No group trips pending review.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left">
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500">Event</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500">Organiser</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500">Date</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500 text-right">Guests</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500">Ticket categories</th>
                    <th className="px-5 py-3 text-xs font-semibold text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pendingTrips.map((trip) => (
                    <tr key={trip.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900">{trip.title}</p>
                        <p className="text-xs text-gray-400">{trip.venue}{trip.city ? `, ${trip.city}` : ""}</p>
                        <p className="mt-0.5 text-xs text-gray-400">
                          Submitted {format(trip.createdAt, "dd MMM yyyy")}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-gray-700">{trip.seller.name ?? "—"}</p>
                        <p className="text-xs text-gray-400">{trip.seller.email}</p>
                      </td>
                      <td className="px-5 py-4 text-gray-600 whitespace-nowrap">
                        {format(trip.date, "dd MMM yyyy")}
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-amber-600">
                        {trip.groupTripCapacity ?? "—"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="space-y-0.5">
                          {trip.ticketCategories.map((cat, i) => (
                            <p key={i} className="text-xs text-gray-600">
                              {cat.name} — {cat.totalQuantity} slots @ KES {Number(cat.price).toLocaleString()}
                            </p>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          <ApproveGroupTripButton eventId={trip.id} eventTitle={trip.title} />
                          <RejectGroupTripButton eventId={trip.id} eventTitle={trip.title} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Expansion requests ── */}
        <section>
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Capacity expansion requests</h2>
            {expansionRequests.length > 0 && (
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                {expansionRequests.length}
              </span>
            )}
          </div>

          {expansionRequests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center">
              <p className="text-sm font-semibold text-gray-500">No expansion requests pending.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {expansionRequests.map((req) => {
                const invitees = Array.isArray(req.inviteeDetails)
                  ? (req.inviteeDetails as { name?: string; email: string; phone: string }[])
                  : [];
                return (
                  <div key={req.id} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-bold text-gray-900">{req.event.title}</h3>
                          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                            +{req.requestedAdditional} requested
                          </span>
                          <span className="text-xs text-gray-400">
                            (current: {req.event.groupTripCapacity ?? "?"} → new: {(req.event.groupTripCapacity ?? 0) + req.requestedAdditional})
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mb-1">
                          {req.event.seller.name} · {req.event.seller.email} · submitted {format(req.createdAt, "dd MMM yyyy")}
                        </p>
                        <p className="text-sm text-gray-700 mb-3">
                          <span className="font-semibold text-gray-500 text-xs uppercase tracking-wide mr-1.5">Reason:</span>
                          {req.reason}
                        </p>

                        {/* Invitee list */}
                        {invitees.length > 0 && (
                          <div>
                            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                              Submitted invitees ({invitees.length})
                            </p>
                            <div className="overflow-hidden rounded-xl border border-gray-100">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-gray-50 text-left">
                                    <th className="px-3 py-2 font-semibold text-gray-500">Name</th>
                                    <th className="px-3 py-2 font-semibold text-gray-500">Email</th>
                                    <th className="px-3 py-2 font-semibold text-gray-500">Phone</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {invitees.map((inv, i) => (
                                    <tr key={i}>
                                      <td className="px-3 py-2 text-gray-700">{inv.name ?? "—"}</td>
                                      <td className="px-3 py-2 text-gray-700">{inv.email}</td>
                                      <td className="px-3 py-2 text-gray-700">{inv.phone}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 lg:flex-col lg:items-end">
                        <ApproveExpansionButton
                          requestId={req.id}
                          eventTitle={req.event.title}
                          additional={req.requestedAdditional}
                        />
                        <RejectExpansionButton requestId={req.id} eventTitle={req.event.title} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
