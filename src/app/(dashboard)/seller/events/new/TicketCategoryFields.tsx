"use client";

import { useMemo, useState, useEffect } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { DatePicker } from "@/components/ui/DatePicker";
import type { CreateEventFormData } from "@/lib/schemas/event";

interface Props {
  index: number;
  onRemove?: () => void;
  isFreeEvent?: boolean;
  maxTotalQuantity?: number;
}

export function TicketCategoryFields({ index, onRemove, isFreeEvent = false, maxTotalQuantity }: Props) {
  void maxTotalQuantity;
  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<CreateEventFormData>();

  const allowInstallments = useWatch({
    control,
    name: `ticketCategories.${index}.allowInstallments`,
  });

  const initialPct = useWatch({
    control,
    name: `ticketCategories.${index}.installmentPlan.initialPaymentPercent`,
  });

  const scheduleItems = useWatch({
    control,
    name: `ticketCategories.${index}.installmentPlan.scheduleItems`,
  });

  const eventDateStr = useWatch({ control, name: "date" });

  const enforceRevocation = useWatch({
    control,
    name: `ticketCategories.${index}.installmentPlan.enforceRevocation`,
  });

  const gracePeriodDays = useWatch({
    control,
    name: `ticketCategories.${index}.installmentPlan.gracePeriodDays`,
  });

  const graceOverridesEventCutoff = useWatch({
    control,
    name: `ticketCategories.${index}.installmentPlan.graceOverridesEventCutoff`,
  });

  // Max allowed grace = whole days from the latest due date to event start time (hard cap)
  const maxGraceDays = useMemo(() => {
    if (!eventDateStr || !scheduleItems?.length) return undefined;
    const eventDate = new Date(eventDateStr); // preserves event start time
    let min = Infinity;
    for (const item of scheduleItems as { dueDate?: string }[]) {
      if (!item?.dueDate) continue;
      const due = new Date(item.dueDate);
      const diff = Math.floor((eventDate.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));
      if (diff < min) min = diff;
    }
    return min === Infinity ? undefined : Math.max(1, min);
  }, [eventDateStr, scheduleItems]);

  // Auto-cap grace period to maxGraceDays and notify when it would exceed the hard cap
  const [cappedNotice, setCappedNotice] = useState(false);
  useEffect(() => {
    if (maxGraceDays !== undefined && Number(gracePeriodDays) > maxGraceDays) {
      setValue(
        `ticketCategories.${index}.installmentPlan.gracePeriodDays`,
        maxGraceDays,
        { shouldValidate: true },
      );
      setCappedNotice(true);
    } else {
      setCappedNotice(false);
    }
  }, [gracePeriodDays, maxGraceDays]); // eslint-disable-line react-hooks/exhaustive-deps

  // Info when any due date falls within t-3 (t-3 rule is auto-bypassed for those instalments)
  const hasDueWithinCutoff = useMemo(() => {
    if (!enforceRevocation || !eventDateStr || !scheduleItems?.length) return false;
    const cutoff = new Date(new Date(eventDateStr).getTime() - 3 * 24 * 60 * 60 * 1000);
    return (scheduleItems as { dueDate?: string }[]).some(
      (item) => item?.dueDate && new Date(item.dueDate) >= cutoff,
    );
  }, [enforceRevocation, eventDateStr, scheduleItems]);

  // Warn when any due date + grace period extends past eventDate − 3 days
  const graceExceedsCutoff = useMemo(() => {
    if (!enforceRevocation || !eventDateStr || !gracePeriodDays || !scheduleItems?.length) return false;
    const eventDate = new Date(eventDateStr);
    const cutoff = new Date(eventDate.getTime() - 3 * 24 * 60 * 60 * 1000);
    return scheduleItems.some((item: { dueDate?: string }) => {
      if (!item?.dueDate) return false;
      const due = new Date(item.dueDate);
      const graceEnd = new Date(due);
      graceEnd.setDate(graceEnd.getDate() + Number(gracePeriodDays));
      return due < cutoff && graceEnd > cutoff;
    });
  }, [enforceRevocation, eventDateStr, gracePeriodDays, scheduleItems]);


  const { fields: scheduleFields, append: appendSchedule, remove: removeSchedule } =
    useFieldArray({
      control,
      name: `ticketCategories.${index}.installmentPlan.scheduleItems`,
    });

  const catErrors = errors.ticketCategories?.[index];
  const planErrors = catErrors?.installmentPlan;

  const scheduleTotal = (scheduleItems ?? []).reduce(
    (sum: number, item: { percentage?: number }) =>
      sum + (Number(item?.percentage) || 0),
    0
  );
  const totalPct = (Number(initialPct) || 0) + scheduleTotal;
  const remaining = 100 - totalPct;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900">Category {index + 1}</h3>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="text-sm text-red-500 hover:text-red-700"
            >
              Remove
            </button>
          )}
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {/* Name / price / qty */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label required>Name</Label>
            <Input
              placeholder="e.g. VIP"
              error={catErrors?.name?.message}
              {...register(`ticketCategories.${index}.name`)}
            />
          </div>
          <div>
            <Label required>Price (KES)</Label>
            {isFreeEvent ? (
              <div className="flex h-10 w-full items-center rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-400">
                Free
                <input type="hidden" {...register(`ticketCategories.${index}.price`, { valueAsNumber: true })} value={0} />
              </div>
            ) : (
              <Input
                type="number"
                min={1}
                placeholder="5000"
                error={catErrors?.price?.message}
                {...register(`ticketCategories.${index}.price`, {
                  valueAsNumber: true,
                })}
              />
            )}
          </div>
          <div>
            <Label required>Available tickets</Label>
            <Input
              type="number"
              min={1}
              placeholder="100"
              error={catErrors?.totalQuantity?.message}
              {...register(`ticketCategories.${index}.totalQuantity`, {
                valueAsNumber: true,
              })}
            />
          </div>
        </div>

        <div>
          <Label>Description (optional)</Label>
          <Input
            placeholder="e.g. Includes backstage access"
            {...register(`ticketCategories.${index}.description`)}
          />
        </div>

        {/* Installments toggle + plan config — hidden for free events */}
        {!isFreeEvent && (
          <>
          <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="sr-only peer"
                {...register(`ticketCategories.${index}.allowInstallments`)}
              />
              <span className="h-6 w-11 rounded-full bg-gray-300 transition-colors peer-checked:bg-primary-600 after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" />
            </label>
            <div>
              <p className="text-sm font-medium text-gray-900">Allow installments</p>
              <p className="text-xs text-gray-500">Buyers can pay in multiple installments</p>
            </div>
          </div>

          {/* Installment plan config — shown only when toggle is on */}
          {allowInstallments && (
          <div className="rounded-lg border border-primary-200 bg-primary-50 p-4 space-y-4">
            <p className="text-sm font-medium text-primary-800">Installment plan</p>

            <div className="max-w-xs">
              <Label required>Initial payment (%)</Label>
              <Input
                type="number"
                min={1}
                max={99}
                placeholder="30"
                error={planErrors?.initialPaymentPercent?.message}
                {...register(
                  `ticketCategories.${index}.installmentPlan.initialPaymentPercent`,
                  { valueAsNumber: true }
                )}
              />
            </div>

            {/* Enforce revocation toggle — all paid events */}
            <div className="flex items-start gap-3 rounded-lg border border-primary-200 bg-white px-4 py-3">
              <label className="relative mt-0.5 inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  {...register(`ticketCategories.${index}.installmentPlan.enforceRevocation`)}
                />
                <span className="h-5 w-9 rounded-full bg-gray-300 transition-colors peer-checked:bg-primary-600 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4" />
              </label>
              <div>
                <p className="text-sm font-medium text-primary-800">Auto-revoke on missed payment</p>
                <p className="text-xs text-gray-500">
                  {enforceRevocation
                    ? "Tickets are automatically revoked after the grace period. By default, revocation also fires 3 days before the event."
                    : "Disabled — you will manage revocations manually from your event dashboard."}
                </p>
                <a
                  href="/terms#05"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-xs font-medium text-primary-600 hover:underline"
                >
                  Learn how revocation works →
                </a>
              </div>
            </div>

            {/* Percentage progress bar */}
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={`h-full rounded-full transition-all ${
                      totalPct > 100
                        ? "bg-red-500"
                        : totalPct === 100
                          ? "bg-green-500"
                          : "bg-primary-500"
                    }`}
                    style={{ width: `${Math.min(totalPct, 100)}%` }}
                  />
                </div>
                <span
                  className={`text-sm font-medium tabular-nums ${
                    totalPct > 100
                      ? "text-red-600"
                      : totalPct === 100
                        ? "text-green-600"
                        : "text-gray-600"
                  }`}
                >
                  {totalPct}% / 100%
                </span>
              </div>
              {totalPct > 100 && (
                <p className="text-xs text-red-600">Total exceeds 100%. Adjust the percentages.</p>
              )}
              {totalPct < 100 && totalPct > 0 && (
                <p className="text-xs text-amber-600">
                  {remaining}% unassigned — add another installment or adjust existing ones.
                </p>
              )}
            </div>

            {/* Schedule items */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">Installment schedule</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    appendSchedule({
                      installmentNumber: scheduleFields.length + 1,
                      percentage: 0,
                      dueDate: "",
                    })
                  }
                >
                  + Add installment
                </Button>
              </div>

              {planErrors?.scheduleItems?.root && (
                <p className="mb-2 text-xs text-red-600">
                  {planErrors.scheduleItems.root.message}
                </p>
              )}

              <div className="space-y-2">
                {scheduleFields.map((sf, si) => (
                  <div
                    key={sf.id}
                    className="flex items-end gap-3 rounded-lg border border-gray-200 bg-white p-3"
                  >
                    <span className="w-5 pb-1.5 text-sm font-medium text-gray-400">
                      {si + 1}.
                    </span>
                    <div className="flex-1">
                      <Label>Percentage (%)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={99}
                        placeholder="25"
                        error={planErrors?.scheduleItems?.[si]?.percentage?.message}
                        {...register(
                          `ticketCategories.${index}.installmentPlan.scheduleItems.${si}.percentage`,
                          { valueAsNumber: true }
                        )}
                      />
                    </div>
                    <div className="flex-1">
                      <Label>Due date</Label>
                      <DatePicker
                        value={watch(`ticketCategories.${index}.installmentPlan.scheduleItems.${si}.dueDate`) ?? ""}
                        onChange={(v) => setValue(`ticketCategories.${index}.installmentPlan.scheduleItems.${si}.dueDate`, v, { shouldValidate: true })}
                        error={planErrors?.scheduleItems?.[si]?.dueDate?.message}
                        disabled={(date) => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          if (date < today) return true;
                          if (eventDateStr) {
                            const eventDate = new Date(eventDateStr);
                            eventDate.setHours(0, 0, 0, 0);
                            if (date > eventDate) return true;
                          }
                          if (si > 0) {
                            const prevDue = scheduleItems?.[si - 1]?.dueDate;
                            if (prevDue) {
                              const prevDate = new Date(prevDue);
                              prevDate.setHours(0, 0, 0, 0);
                              if (date <= prevDate) return true;
                            }
                          }
                          return false;
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSchedule(si)}
                      className="pb-1.5 text-red-400 hover:text-red-600"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              {scheduleFields.length === 0 && (
                <p className="py-3 text-center text-sm text-gray-400">
                  No installments added yet. Click &quot;+ Add installment&quot; above.
                </p>
              )}
            </div>

            {/* Grace period — sits below the schedule so the max is already visible */}
            {enforceRevocation && (
              <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Grace period</p>
                  <p className="mt-1 text-xs text-gray-500">
                    The number of days after a missed due date before the ticket is automatically revoked.
                    Buyers receive a daily reminder email throughout this window.
                    Grace period must end before the event starts.
                  </p>
                </div>
                <div className="max-w-xs">
                  <Label>Days</Label>
                  <Input
                    type="number"
                    min={1}
                    max={maxGraceDays}
                    placeholder="7"
                    error={(planErrors?.gracePeriodDays as { message?: string } | undefined)?.message}
                    {...register(
                      `ticketCategories.${index}.installmentPlan.gracePeriodDays`,
                      { valueAsNumber: true }
                    )}
                  />
                  {maxGraceDays !== undefined && (
                    <p className="mt-1 text-xs font-medium text-amber-600">
                      Max {maxGraceDays} day{maxGraceDays !== 1 ? "s" : ""} — your latest instalment is due {maxGraceDays} day{maxGraceDays !== 1 ? "s" : ""} before the event
                    </p>
                  )}
                  {cappedNotice && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-blue-600">
                      <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
                      </svg>
                      Auto-set to {maxGraceDays} day{maxGraceDays !== 1 ? "s" : ""} — the maximum before grace would extend past the event.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Info: one or more due dates are within t-3 — 3-day rule is auto-bypassed */}
            {hasDueWithinCutoff && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 flex items-start gap-2">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-blue-800">Due date is within 3 days of the event</p>
                  <p className="mt-0.5 text-xs text-blue-700">
                    One or more instalments are due within 3 days of your event. The 3-day-before-event auto-revocation rule is automatically bypassed for those instalments — only the grace period timeline applies.
                  </p>
                </div>
              </div>
            )}

            {/* Warning: grace period extends past the 3-day event cutoff */}
            {graceExceedsCutoff && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 space-y-3">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 text-amber-500">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Grace period extends past 3 days before your event</p>
                    <p className="mt-0.5 text-xs text-amber-700">
                      With your current due date and grace period, some buyers may still be within their grace window when the
                      3-day-before-event rule would normally trigger auto-revocation. By default, the earlier deadline wins.
                      You can override this so the full grace period always applies.
                    </p>
                  </div>
                </div>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                    {...register(`ticketCategories.${index}.installmentPlan.graceOverridesEventCutoff`)}
                  />
                  <span className="text-xs font-medium text-amber-800">
                    I understand — let the grace period run its full course, even if it extends past 3 days before the event.
                    Tickets will only be auto-revoked after the grace period expires.
                  </span>
                </label>
              </div>
            )}
          </div>
          )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
