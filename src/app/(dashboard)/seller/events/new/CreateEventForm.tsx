"use client";

import { useFieldArray, useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { MultiImageUpload } from "@/components/ui/MultiImageUpload";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { createEvent, updateEvent } from "@/app/actions/events";
import { createEventSchema, editEventSchema, type CreateEventFormData } from "@/lib/schemas/event";
import { TicketCategoryFields } from "./TicketCategoryFields";
import type { PayoutMethodData } from "@/app/actions/payout";
import { PayoutMethodForm } from "@/components/PayoutMethodForm";

interface Props {
  eventId?: string;
  defaultValues?: CreateEventFormData;
  payoutMethods: PayoutMethodData[];
  payoutMethodLocked?: boolean;
  eventType?: "FREE" | "PAID";
  experienceType?: "PUBLIC" | "INVITE_ONLY" | "GROUP_TRIP";
  groupTripGuestCount?: number;
  groupTripAutoApproveCap?: number;
}

const BLANK_CATEGORY: CreateEventFormData["ticketCategories"][number] = {
  name: "",
  price: 0,
  totalQuantity: 0,
  allowInstallments: false,
  sortOrder: 0,
  installmentPlan: {
    initialPaymentPercent: 30,
    gracePeriodDays: 7,
    enforceRevocation: false,
    graceOverridesEventCutoff: false,
    scheduleItems: [],
  },
};

const MOBILE_MONEY_TYPES = new Set(["mobile_money", "mobile_money_business"]);

function methodDisplay(m: PayoutMethodData) {
  if (m.bankType === "mobile_money_business") {
    return `Paybill: ${m.accountNumber}${m.accountName ? ` · Acc: ${m.accountName}` : ""}`;
  }
  if (m.bankType === "mobile_money") return m.accountNumber;
  return `****${m.accountNumber.slice(-4)}${m.accountName ? ` · ${m.accountName}` : ""}`;
}

function GroupTripCapacityBar({ guestCount, categories }: { guestCount: number; categories: { totalQuantity?: number }[] }) {
  const used = categories.reduce((s, c) => s + (Number(c.totalQuantity) || 0), 0);
  const pct = Math.min(100, Math.round((used / guestCount) * 100));
  const over = used > guestCount;
  return (
    <div className={`mb-4 rounded-xl border px-4 py-3 ${over ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
      <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
        <span className={over ? "text-red-700" : "text-amber-700"}>
          Ticket capacity: {used} / {guestCount} slots used
        </span>
        {over && <span className="text-red-600">Exceeds declared guest count</span>}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-200">
        <div className={`h-full rounded-full transition-all ${over ? "bg-red-500" : "bg-amber-500"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function CreateEventForm({ eventId, defaultValues, payoutMethods, payoutMethodLocked = false, eventType: eventTypeProp, experienceType: experienceTypeProp, groupTripGuestCount, groupTripAutoApproveCap }: Props) {
  void groupTripAutoApproveCap;
  const isEdit = Boolean(eventId);
  const router = useRouter();
  const todayMin = useMemo(() => format(new Date(), "yyyy-MM-dd'T'HH:mm"), []);
  const [serverError, setServerError] = useState("");
  const [localMethods, setLocalMethods] = useState<PayoutMethodData[]>(payoutMethods);
  const [showPayoutForm, setShowPayoutForm] = useState(false);

  const resolvedEventType = (defaultValues?.eventType ?? eventTypeProp ?? "PAID") as "FREE" | "PAID";
  const resolvedExperienceType = (defaultValues?.experienceType ?? experienceTypeProp ?? "PUBLIC") as "PUBLIC" | "INVITE_ONLY" | "GROUP_TRIP";
  const isFree = resolvedEventType === "FREE";
  const isGroupTrip = resolvedExperienceType === "GROUP_TRIP";

  const methods = useForm<CreateEventFormData, unknown, CreateEventFormData>({
    resolver: zodResolver(isEdit ? editEventSchema : createEventSchema),
    defaultValues: defaultValues ?? {
      ticketCategories: [{ ...BLANK_CATEGORY }],
      payoutMethodId: payoutMethods.length === 1 ? payoutMethods[0].id : "",
      eventType: resolvedEventType,
      experienceType: resolvedExperienceType,
      isPrivate: resolvedExperienceType !== "PUBLIC",
    },
  });

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = methods;

  useEffect(() => {
    setValue("eventType", resolvedEventType);
    setValue("experienceType", resolvedExperienceType);
    if (!isEdit) {
      const defaultEnforce = resolvedExperienceType === "PUBLIC";
      getValues("ticketCategories").forEach((_, i) => {
        setValue(`ticketCategories.${i}.installmentPlan.enforceRevocation`, defaultEnforce);
      });
    }
  }, [resolvedEventType, resolvedExperienceType, setValue, getValues, isEdit]);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "ticketCategories",
  });

  const selectedMethodId = watch("payoutMethodId");
  const isPrivate = watch("isPrivate");
  const watchedCategories = watch("ticketCategories");

  async function onSubmit(data: CreateEventFormData) {
    setServerError("");
    const res = isEdit
      ? await updateEvent(eventId!, data)
      : await createEvent(data);
    if (!res.ok) {
      setServerError(res.error);
      return;
    }
    if (!isEdit && data.eventType === "FREE" && data.experienceType === "PUBLIC") {
      // FREE public events go straight to activation (tier picker)
      router.push(`/seller/events/${res.data.id}/activate`);
    } else if (!isEdit && "pendingReview" in res.data && res.data.pendingReview) {
      // GROUP_TRIP awaiting admin review — can't pay listing fee until approved
      router.push(`/seller/events/${res.data.id}?pendingReview=1`);
    } else if (!isEdit && data.experienceType === "GROUP_TRIP") {
      // GROUP_TRIP auto-approved — redirect immediately to pay listing fee
      router.push(`/seller/events/${res.data.id}/activate?created=1`);
    } else {
      router.push(`/seller/events/${res.data.id}`);
    }
  }

  const cancelHref = isEdit ? `/seller/events/${eventId}` : "/seller";

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Hidden fields */}
        <input type="hidden" {...register("eventType")} />
        <input type="hidden" {...register("experienceType")} />

        {serverError && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        {/* Basic info */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Experience details</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <Label htmlFor="title" required>Event title</Label>
              <Input
                id="title"
                placeholder="e.g. Nairobi Jazz Festival 2026"
                error={errors.title?.message}
                {...register("title")}
              />
            </div>

            <div>
              <Label htmlFor="description" required>Description</Label>
              <Textarea
                id="description"
                rows={4}
                placeholder="Describe your event..."
                error={errors.description?.message}
                {...register("description")}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label required>Start date &amp; time</Label>
                <DateTimePicker
                  value={watch("date")}
                  onChange={(v) => setValue("date", v)}
                  minDateTime={isEdit ? undefined : todayMin}
                  placeholder="Pick start date & time"
                  error={errors.date?.message}
                />
              </div>
              <div>
                <Label>End date &amp; time</Label>
                <DateTimePicker
                  value={watch("endDate") ?? ""}
                  onChange={(v) => setValue("endDate", v)}
                  minDateTime={watch("date") || undefined}
                  placeholder="Pick end date & time"
                  error={errors.endDate?.message}
                />
              </div>
            </div>

            <div>
              <Label>Images</Label>
              <MultiImageUpload
                value={watch("images") ?? []}
                onChange={(urls) => setValue("images", urls, { shouldDirty: true })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="venue" required>Venue</Label>
                <Input
                  id="venue"
                  placeholder="e.g. KICC Auditorium"
                  error={errors.venue?.message}
                  {...register("venue")}
                />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="e.g. Nairobi"
                  {...register("city")}
                />
              </div>
            </div>

            {/* Private toggle */}
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  {...register("isPrivate")}
                />
                <span className="h-6 w-11 rounded-full bg-gray-300 transition-colors peer-checked:bg-primary-600 after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" />
              </label>
              <div>
                <p className="text-sm font-medium text-gray-900">Private experience</p>
                <p className="text-xs text-gray-500">
                  {isPrivate
                    ? "Only accessible to people with the direct link. Not listed on the public events page."
                    : "Publicly listed on the events page. Anyone can discover and register."}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Payout method — hidden for free events */}
        {!isFree && (
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-gray-900">Payout method</h2>
            </CardHeader>
            <CardBody>
              <p className="mb-1 text-sm text-gray-500">
                Choose where ticket sales revenue will be sent for this event.
              </p>
              <p className="mb-3 text-xs text-gray-400">
                This cannot be changed once any payment has been received.
              </p>

              {payoutMethodLocked ? (
                (() => {
                  const locked = localMethods.find((m) => m.id === selectedMethodId);
                  return (
                    <div className="space-y-2">
                      {locked && (
                        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-gray-900">{locked.bankName}</span>
                              {locked.label && (
                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
                                  {locked.label}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-sm text-gray-500">{methodDisplay(locked)}</p>
                          </div>
                          <div className="flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                            </svg>
                            Locked
                          </div>
                          <input type="hidden" {...register("payoutMethodId")} />
                        </div>
                      )}
                      <p className="text-xs text-gray-400">
                        Payout method cannot be changed once payments have been received for this event.
                      </p>
                    </div>
                  );
                })()
              ) : (
                <>
              {localMethods.length > 0 && (
                <div className="space-y-2">
                  {localMethods.map((m) => {
                    const checked = selectedMethodId === m.id;
                    return (
                      <label
                        key={m.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                          checked
                            ? "border-primary-500 bg-primary-50"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        <input
                          type="radio"
                          value={m.id}
                          {...register("payoutMethodId")}
                          className="h-4 w-4 accent-primary-600"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-gray-900">{m.bankName}</span>
                            {m.label && (
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
                                {m.label}
                              </span>
                            )}
                            {MOBILE_MONEY_TYPES.has(m.bankType) && (
                              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600">
                                Mobile money
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-sm text-gray-500">{methodDisplay(m)}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              {showPayoutForm ? (
                <div className={localMethods.length > 0 ? "mt-3" : ""}>
                  <PayoutMethodForm
                    onSaved={(newMethod) => {
                      setLocalMethods((prev) => [...prev, newMethod]);
                      setValue("payoutMethodId", newMethod.id, { shouldValidate: true });
                      setShowPayoutForm(false);
                    }}
                    onCancel={() => setShowPayoutForm(false)}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowPayoutForm(true)}
                  className={`flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700 ${localMethods.length > 0 ? "mt-3" : ""}`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  {localMethods.length === 0 ? "Add a payout method" : "Add another method"}
                </button>
              )}

              {errors.payoutMethodId && !showPayoutForm && (
                <p className="mt-2 text-sm text-red-600">{errors.payoutMethodId.message}</p>
              )}
                </>
              )}
            </CardBody>
          </Card>
        )}

        {/* Ticket categories / Participant spots */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">
                {isGroupTrip ? "Participant spots" : "Ticket categories"}
              </h2>
              <p className="text-sm text-gray-500">
                {isGroupTrip
                  ? "Define pricing tiers for participants (e.g. Single, Couple, Family)."
                  : isFree
                    ? "Add one or more ticket tiers (e.g. General, VIP). Prices are locked at free."
                    : "Add one or more ticket tiers (e.g. Regular, VIP)"}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                append({
                  ...BLANK_CATEGORY,
                  sortOrder: fields.length,
                  installmentPlan: {
                    initialPaymentPercent: 30,
                    gracePeriodDays: 7,
                    enforceRevocation: resolvedExperienceType === "PUBLIC",
                    graceOverridesEventCutoff: false,
                    scheduleItems: [],
                  },
                })
              }
            >
              + Add category
            </Button>
          </div>

          {errors.ticketCategories?.root && (
            <p className="mb-2 text-sm text-red-600">
              {errors.ticketCategories.root.message}
            </p>
          )}

          {isGroupTrip && groupTripGuestCount && (
            <GroupTripCapacityBar
              guestCount={groupTripGuestCount}
              categories={watchedCategories}
            />
          )}

          <div className="space-y-4">
            {fields.map((field, index) => (
              <TicketCategoryFields
                key={field.id}
                index={index}
                onRemove={fields.length > 1 ? () => remove(index) : undefined}
                isFreeEvent={isFree}
                maxTotalQuantity={isGroupTrip && groupTripGuestCount ? groupTripGuestCount : undefined}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pb-8">
          <a href={cancelHref}>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </a>
          <Button type="submit" loading={isSubmitting}>
            {isEdit ? "Save changes" : "Create event"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
