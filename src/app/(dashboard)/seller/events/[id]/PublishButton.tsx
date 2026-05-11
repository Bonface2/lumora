"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { publishEvent, unpublishEvent } from "@/app/actions/events";
import type { EventStatus } from "@prisma/client";

export function PublishButton({
  eventId,
  status,
}: {
  eventId: string;
  status: EventStatus;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    setLoading(true);
    setError("");
    const res =
      status === "PUBLISHED"
        ? await unpublishEvent(eventId)
        : await publishEvent(eventId);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  const isPublished = status === "PUBLISHED";

  return (
    <div className="flex items-center gap-2">
      {error && <p className="text-xs text-red-400 max-w-xs text-right">{error}</p>}
      <button
        onClick={toggle}
        disabled={loading}
        className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors disabled:opacity-50 ${
          isPublished
            ? "border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
            : "bg-primary-600 text-white hover:bg-primary-500"
        }`}
      >
        {loading ? (
          <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        ) : isPublished ? (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        ) : (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
        {loading ? "Saving…" : isPublished ? "Unpublish" : "Publish event"}
      </button>
    </div>
  );
}
