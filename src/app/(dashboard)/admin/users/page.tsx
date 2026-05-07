import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-50 text-red-700",
  SELLER: "bg-primary-50 text-primary-700",
  BUYER: "bg-gray-100 text-gray-600",
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; role?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/");

  const { search, role } = await searchParams;

  const users = await db.user.findMany({
    where: {
      ...(role ? { role: role as "BUYER" | "SELLER" | "ADMIN" } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      _count: { select: { orders: true, events: true } },
    },
  });

  return (
    <div className="min-h-full bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-gray-900">Users</h1>
          <p className="mt-1 text-sm text-gray-500">{users.length} total</p>
        </div>

        {/* Filters */}
        <form method="get" className="mb-4 flex flex-wrap gap-3">
          <input
            name="search"
            defaultValue={search ?? ""}
            placeholder="Search name or email…"
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 w-64"
          />
          <select
            name="role"
            defaultValue={role ?? ""}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">All roles</option>
            <option value="BUYER">Buyers</option>
            <option value="SELLER">Sellers</option>
            <option value="ADMIN">Admins</option>
          </select>
          <button
            type="submit"
            className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
          >
            Filter
          </button>
          {(search || role) && (
            <a
              href="/admin/users"
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
                <th className="px-5 py-3 font-semibold text-gray-600">User</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Role</th>
                <th className="px-5 py-3 font-semibold text-gray-600 text-right">Orders</th>
                <th className="px-5 py-3 font-semibold text-gray-600 text-right">Events</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Joined</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => {
                const initials = u.name
                  ? u.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
                  : u.email[0].toUpperCase();
                return (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-black text-primary-700">
                          {initials}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{u.name ?? "—"}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLORS[u.role]}`}>
                        {u.role.charAt(0) + u.role.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right text-gray-600">{u._count.orders}</td>
                    <td className="px-5 py-4 text-right text-gray-600">{u._count.events}</td>
                    <td className="px-5 py-4 text-gray-500">
                      {new Date(u.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <a
                        href={`/admin/users/${u.id}`}
                        className="text-sm font-semibold text-primary-600 hover:underline"
                      >
                        Manage
                      </a>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400">
                    No users found.
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
