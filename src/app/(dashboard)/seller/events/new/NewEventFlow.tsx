"use client";

import { useState } from "react";
import { ExperienceTypeSelector } from "./ExperienceTypeSelector";
import { EventTypeSelector } from "./EventTypeSelector";
import { CreateEventForm } from "./CreateEventForm";
import type { CreateEventFormData } from "@/lib/schemas/event";
import type { PayoutMethodData } from "@/app/actions/payout";

type ExperienceType = "PUBLIC" | "INVITE_ONLY" | "GROUP_TRIP";
type EventType = "FREE" | "PAID";
type Step = "select-experience" | "select-billing" | "group-trip-size" | "form";

const EXPERIENCE_LABELS: Record<ExperienceType, string> = {
  PUBLIC: "Public event",
  INVITE_ONLY: "Invite-only",
  GROUP_TRIP: "Group trip",
};

interface Props {
  payoutMethods: PayoutMethodData[];
  defaultValues: CreateEventFormData;
  groupTripAutoApproveCap: number;
}

export function NewEventFlow({ payoutMethods, defaultValues, groupTripAutoApproveCap }: Props) {
  const [step, setStep] = useState<Step>("select-experience");
  const [experienceType, setExperienceType] = useState<ExperienceType>("PUBLIC");
  const [eventType, setEventType] = useState<EventType>("PAID");
  const [guestCount, setGuestCount] = useState<string>("");
  const [guestCountError, setGuestCountError] = useState("");
  const [groupTripConfirmed, setGroupTripConfirmed] = useState(false);

  function handleSelectExperience(type: ExperienceType) {
    setExperienceType(type);
    if (type === "GROUP_TRIP") {
      setEventType("PAID");
      setStep("group-trip-size");
    } else {
      setStep("select-billing");
    }
  }

  function handleSelectBilling(type: EventType) {
    setEventType(type);
    setStep("form");
  }

  function handleGuestCountContinue() {
    const n = parseInt(guestCount, 10);
    if (!guestCount || isNaN(n) || n < 1) {
      setGuestCountError("Enter a valid number of guests (at least 1).");
      return;
    }
    setGuestCountError("");
    setStep("form");
  }

  const parsedGuestCount = parseInt(guestCount, 10);
  const willNeedReview = !isNaN(parsedGuestCount) && parsedGuestCount > groupTripAutoApproveCap;

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
        <ExperienceTypeSelector onSelect={handleSelectExperience} groupTripAutoApproveCap={groupTripAutoApproveCap} />
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

  if (step === "group-trip-size") {
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
          <span className="rounded-full bg-amber-50 px-3 py-0.5 text-xs font-bold text-amber-700 ring-1 ring-amber-200">
            Group trip
          </span>
        </div>

        <div className="mb-6 text-center">
          <p className="text-sm font-medium text-gray-500">Step 2 of 3</p>
          <h2 className="mt-1 text-xl font-bold text-gray-900">How many guests are in your group?</h2>
          <p className="mt-1 text-sm text-gray-500">
            This is the maximum number of participants for this trip.
          </p>
        </div>

        <div className="mx-auto max-w-sm">
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">
              Expected number of guests
            </label>
            <input
              type="number"
              min="1"
              value={guestCount}
              onChange={(e) => { setGuestCount(e.target.value); setGuestCountError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleGuestCountContinue()}
              placeholder="e.g. 8"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary-500"
              autoFocus
            />
            {guestCountError && (
              <p className="mt-1.5 text-xs text-red-600">{guestCountError}</p>
            )}

            {/* Policy notice */}
            <div className="mt-4 space-y-2">
              <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50 px-3 py-2.5">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-xs text-emerald-700">
                  Groups up to <strong>{groupTripAutoApproveCap} guests</strong> are automatically approved and go straight to draft.
                </p>
              </div>
              <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 px-3 py-2.5">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-amber-700">
                  Groups of <strong>more than {groupTripAutoApproveCap} guests</strong> require Lumora support to review and approve before publishing. You&apos;ll be notified once approved.
                </p>
              </div>
            </div>

            {/* Live preview of outcome */}
            {!isNaN(parsedGuestCount) && parsedGuestCount > 0 && (
              <div className={`mt-3 flex items-start gap-2.5 rounded-xl px-3 py-2.5 ${willNeedReview ? "bg-orange-50" : "bg-blue-50"}`}>
                <svg className={`mt-0.5 h-4 w-4 shrink-0 ${willNeedReview ? "text-orange-500" : "text-blue-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={willNeedReview ? "M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" : "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"} />
                </svg>
                <p className={`text-xs ${willNeedReview ? "text-orange-700" : "text-blue-700"}`}>
                  {willNeedReview
                    ? `A group of ${parsedGuestCount} will be submitted for admin review. You'll receive an email once it's approved.`
                    : `A group of ${parsedGuestCount} will be auto-approved. You can publish immediately after creating the event.`}
                </p>
              </div>
            )}

            {/* Declaration */}
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <input
                type="checkbox"
                checked={groupTripConfirmed}
                onChange={(e) => setGroupTripConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 accent-primary-600"
              />
              <span className="text-xs leading-relaxed text-amber-800">
                I confirm that this is a genuine social group trip organised for people I know personally, and that I am <strong>not</strong> running a commercial tour, travel package, safari, or any paid tourism service. I understand that if I am found to be conducting a commercial operation under the Group Trip category, I will face <strong>immediate account termination, forfeiture of payouts, and criminal prosecution</strong> under the laws of Kenya, including referral to the Kenya Revenue Authority.{" "}
                <a href="/terms#10" target="_blank" className="font-semibold underline" onClick={(e) => e.stopPropagation()}>
                  Read Group Trip Policy →
                </a>
              </span>
            </label>

            <button
              type="button"
              onClick={handleGuestCountContinue}
              disabled={!groupTripConfirmed}
              className="mt-4 w-full rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => experienceType === "GROUP_TRIP" ? setStep("group-trip-size") : setStep("select-billing")}
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
          {experienceType === "GROUP_TRIP" && !isNaN(parsedGuestCount) && ` · ${parsedGuestCount} guests`}
        </span>
      </div>
      <CreateEventForm
        payoutMethods={payoutMethods}
        defaultValues={{
          ...defaultValues,
          eventType,
          experienceType,
          isPrivate: experienceType !== "PUBLIC",
          groupTripGuestCount: experienceType === "GROUP_TRIP" && !isNaN(parsedGuestCount) ? parsedGuestCount : undefined,
        }}
        eventType={eventType}
        experienceType={experienceType}
        groupTripGuestCount={experienceType === "GROUP_TRIP" && !isNaN(parsedGuestCount) ? parsedGuestCount : undefined}
        groupTripAutoApproveCap={groupTripAutoApproveCap}
      />
    </div>
  );
}
