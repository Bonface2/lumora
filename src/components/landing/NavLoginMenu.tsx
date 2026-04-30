"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

export function NavLoginMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold tracking-wide text-gray-700 transition-all hover:border-primary-400 hover:text-primary-700"
      >
        Sign in
        <svg
          className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl">
          <Link
            href="/login"
            onClick={() => setOpen(false)}
            className="flex items-start gap-3 p-4 transition-colors hover:bg-primary-50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100">
              <svg className="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900">Buyer sign in</p>
              <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
                Browse events, track orders, and manage your installment payments.
              </p>
            </div>
            <svg className="h-4 w-4 self-center text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <div className="mx-4 border-t border-gray-100" />

          <Link
            href="/login?role=seller"
            onClick={() => setOpen(false)}
            className="flex items-start gap-3 p-4 transition-colors hover:bg-primary-50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100">
              <svg className="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900">Seller sign in</p>
              <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
                Manage events, track revenue, and reach your audience.
              </p>
            </div>
            <svg className="h-4 w-4 self-center text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-xs text-gray-400">
              New here?{" "}
              <Link
                href="/register"
                onClick={() => setOpen(false)}
                className="font-semibold text-primary-600 hover:text-primary-700"
              >
                Create an account →
              </Link>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
