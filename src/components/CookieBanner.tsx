"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "lumora_cookie_consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  function accept() {
    localStorage.setItem(STORAGE_KEY, "accepted");
    setVisible(false);
  }

  function decline() {
    localStorage.setItem(STORAGE_KEY, "declined");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-gray-950/95 backdrop-blur-sm px-6 py-4 md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-300 leading-relaxed">
          We use cookies to keep you logged in and to understand how the site is used.{" "}
          <Link href="/privacy" className="font-semibold text-primary-400 hover:text-primary-300 underline underline-offset-2">
            Privacy Policy
          </Link>
        </p>
        <div className="flex shrink-0 gap-3">
          <button
            onClick={decline}
            className="rounded-xl border border-white/20 px-5 py-2 text-sm font-semibold text-gray-400 hover:text-white transition-colors"
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="rounded-xl bg-primary-600 px-5 py-2 text-sm font-bold text-white hover:bg-primary-500 transition-colors"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
