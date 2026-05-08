"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { initiateEventActivationFee } from "@/app/actions/events";

export function ActivateButton({ eventId }: { eventId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setLoading(true);
    setError("");
    const res = await initiateEventActivationFee(eventId);
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    window.location.href = res.data.authorizationUrl;
  }

  return (
    <div>
      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}
      <Button onClick={handleClick} loading={loading}>
        Pay KES 1,000 &amp; activate
      </Button>
    </div>
  );
}
