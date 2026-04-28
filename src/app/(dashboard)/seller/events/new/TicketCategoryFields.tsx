"use client";

import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import type { CreateEventFormData } from "@/lib/schemas/event";

interface Props {
  index: number;
  onRemove?: () => void;
}

export function TicketCategoryFields({ index, onRemove }: Props) {
  const {
    register,
    control,
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
            <Input
              type="number"
              min={1}
              placeholder="5000"
              error={catErrors?.price?.message}
              {...register(`ticketCategories.${index}.price`, {
                valueAsNumber: true,
              })}
            />
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

        {/* Installments toggle */}
        <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              className="sr-only peer"
              {...register(`ticketCategories.${index}.allowInstallments`)}
            />
            <span className="h-6 w-11 rounded-full bg-gray-300 transition-colors peer-checked:bg-violet-600 after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" />
          </label>
          <div>
            <p className="text-sm font-medium text-gray-900">Allow installments</p>
            <p className="text-xs text-gray-500">Buyers can pay in multiple installments</p>
          </div>
        </div>

        {/* Installment plan config — shown only when toggle is on */}
        {allowInstallments && (
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 space-y-4">
            <p className="text-sm font-medium text-violet-800">Installment plan</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
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
              <div>
                <Label>Grace period (days)</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="7"
                  {...register(
                    `ticketCategories.${index}.installmentPlan.gracePeriodDays`,
                    { valueAsNumber: true }
                  )}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Days after due before ticket is revoked
                </p>
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
                          : "bg-violet-500"
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
                      <Input
                        type="date"
                        error={planErrors?.scheduleItems?.[si]?.dueDate?.message}
                        {...register(
                          `ticketCategories.${index}.installmentPlan.scheduleItems.${si}.dueDate`
                        )}
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
          </div>
        )}
      </CardBody>
    </Card>
  );
}
