"use client";

import { useState } from "react";
import { ExperienceTypeSelector } from "./ExperienceTypeSelector";
import { EventTypeSelector } from "./EventTypeSelector";
import { CreateEventForm } from "./CreateEventForm";
import type { CreateEventFormData } from "@/lib/schemas/event";
import type { PayoutMethodData } from "@/app/actions/payout";

type ExperienceType = "PUBLIC" | "INVITE_ONLY" | "GROUP_TRIP";
type EventType = "FREE" | "PAID";
type Step = "select-experience" | "select-billing" | "form";

const EXPERIENCE_LABELS: Record<ExperienceType, string> = {
  PUBLIC: "Public event",
  INVITE_ONLY: "Invite-only",
  GROUP_TRIP: "Group trip",
};

interface Props {
  payoutMethods: PayoutMethodData[];
  defaultValues: CreateEventFormData;
}

export function NewEventFlow({ payoutMethods, defaultValues }: Props) {
  const [step, setStep] = useState<Step>("select-experience");
  const [experienceType, setExperienceType] = useState<ExperienceType>("PUBLIC");
  const [eventType, setEventType] = useState<EventType>("PAID");

  function handleSelectExperience(type: ExperienceType) {
    setExperienceType(type);
    // GROUP_TRIP always PAID, skip billing step
    if (type === "GROUP_TRIP") {
      setEventType("PAID");
      setStep("form");
    } else {
      setStep("select-billing");
    }
  }

  function handleSelectBilling(type: EventType) {
    setEventType(type);
    setStep("form");
  }

  const isPrivateDefault = experienceType !== "PUBLIC";

  if (step === "select-experience") {
    return (
      <div>
        <div className="mb-6 text-center">
          <p className="text-sm font-medium text-gray-500">Step 1 of 3</p>
          <h2 className="mt-1 text-xl font-bold text-gray-900">What kind of experience is this?</h2>
          <p className="mt-1 text-sm text-gray-500">
            This determines how attendees access your event and how tickets work.
          </p>
        </div>
        <ExperienceTypeSelector onSelect={handleSelectExperience} />
      </div>
    );
  }

  if (step === "select-billing") {
    return (
      <div>
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setStep("select-experience")}
            className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <span className="rounded-full bg-primary-50 px-3 py-0.5 text-xs font-bold text-primary-700">
            {EXPERIENCE_LABELS[experienceType]}
          </span>
        </div>
        <div className="mb-6 text-center">
          <p className="text-sm font-medium text-gray-500">Step 2 of 3</p>
          <h2 className="mt-1 text-xl font-bold text-gray-900">Paid or free?</h2>
          <p className="mt-1 text-sm text-gray-500">
            Choose whether attendees pay for tickets or access is free.
          </p>
        </div>
        <EventTypeSelector onSelect={handleSelectBilling} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => experienceType === "GROUP_TRIP" ? setStep("select-experience") : setStep("select-billing")}
          className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <span className="rounded-full bg-primary-50 px-3 py-0.5 text-xs font-bold text-primary-700">
          {EXPERIENCE_LABELS[experienceType]}
          {experienceType !== "GROUP_TRIP" && ` · ${eventType === "FREE" ? "Free" : "Paid"}`}
        </span>
      </div>
      <CreateEventForm
        payoutMethods={payoutMethods}
        defaultValues={{ ...defaultValues, eventType, experienceType, isPrivate: isPrivateDefault }}
        eventType={eventType}
        experienceType={experienceType}
      />
    </div>
  );
}
