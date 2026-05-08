"use client";

import { useState } from "react";
import { EventTypeSelector } from "./EventTypeSelector";
import { CreateEventForm } from "./CreateEventForm";
import type { CreateEventFormData } from "@/lib/schemas/event";
import type { PayoutMethodData } from "@/app/actions/payout";

interface Props {
  payoutMethods: PayoutMethodData[];
  defaultValues: CreateEventFormData;
}

export function NewEventFlow({ payoutMethods, defaultValues }: Props) {
  const [step, setStep] = useState<"select-type" | "form">("select-type");
  const [eventType, setEventType] = useState<"FREE" | "PAID">("PAID");

  function handleSelect(type: "FREE" | "PAID") {
    setEventType(type);
    setStep("form");
  }

  if (step === "select-type") {
    return (
      <div>
        <div className="mb-6 text-center">
          <p className="text-sm font-medium text-gray-500">Step 1 of 2</p>
          <h2 className="mt-1 text-xl font-bold text-gray-900">Choose your experience type</h2>
          <p className="mt-1 text-sm text-gray-500">
            This determines how attendees access your event.
          </p>
        </div>
        <EventTypeSelector onSelect={handleSelect} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setStep("select-type")}
          className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Change type
        </button>
        <span className="rounded-full bg-primary-50 px-3 py-0.5 text-xs font-bold text-primary-700">
          {eventType === "FREE" ? "Free experience" : "Paid experience"}
        </span>
      </div>
      <CreateEventForm
        payoutMethods={payoutMethods}
        defaultValues={{ ...defaultValues, eventType }}
        eventType={eventType}
      />
    </div>
  );
}
