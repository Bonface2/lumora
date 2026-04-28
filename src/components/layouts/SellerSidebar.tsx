"use client";

import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const nav = [
  {
    label: "Events",
    href: "/seller",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: "Analytics",
    href: "/seller/analytics",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    label: "Defaulters",
    href: "/seller/defaulters",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
];

export function SellerSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user;
  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center border-b border-gray-100 px-6">
        <a href="/" className="text-xl font-bold text-violet-600">Lumora</a>
        <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">Seller</span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {nav.map((item) => {
          const active = item.href === "/seller"
            ? pathname === "/seller"
            : pathname.startsWith(item.href);
          return (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-violet-50 text-violet-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              {item.icon}
              {item.label}
            </a>
          );
        })}
      </nav>

      <div className="border-t border-gray-100 p-3 space-y-1">
        {/* Profile strip */}
        {user && (
          <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0">
              {user.name && (
                <p className="truncate text-sm font-medium text-gray-900">{user.name}</p>
              )}
              <p className="truncate text-xs text-gray-500">{user.email}</p>
            </div>
          </div>
        )}

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  );
}
