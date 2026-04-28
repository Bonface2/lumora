"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
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

  return (
    <div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <Button
        onClick={toggle}
        loading={loading}
        variant={status === "PUBLISHED" ? "secondary" : "primary"}
      >
        {status === "PUBLISHED" ? "Unpublish" : "Publish event"}
      </Button>
    </div>
  );
}
