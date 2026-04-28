"use client";

import { useFieldArray, useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { createEvent } from "@/app/actions/events";
import { createEventSchema, type CreateEventFormData } from "@/lib/schemas/event";
import { TicketCategoryFields } from "./TicketCategoryFields";

export function CreateEventForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");

  const methods = useForm<CreateEventFormData, unknown, CreateEventFormData>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      ticketCategories: [
        {
          name: "",
          price: 0,
          totalQuantity: 0,
          allowInstallments: false,
          sortOrder: 0,
          installmentPlan: {
            initialPaymentPercent: 30,
            gracePeriodDays: 7,
            scheduleItems: [],
          },
        },
      ],
    },
  });

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = methods;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "ticketCategories",
  });

  async function onSubmit(data: CreateEventFormData) {
    setServerError("");
    const res = await createEvent(data);
    if (!res.ok) {
      setServerError(res.error);
      return;
    }
    router.push(`/seller/events/${res.data.id}`);
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {serverError && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        {/* Basic info */}
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Event details</h2>
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
                <Label htmlFor="date" required>Start date &amp; time</Label>
                <Input
                  id="date"
                  type="datetime-local"
                  error={errors.date?.message}
                  {...register("date")}
                />
              </div>
              <div>
                <Label htmlFor="endDate">End date &amp; time</Label>
                <Input
                  id="endDate"
                  type="datetime-local"
                  error={errors.endDate?.message}
                  {...register("endDate")}
                />
              </div>
            </div>

            <div>
              <Label>Cover image</Label>
              <ImageUpload
                value={watch("coverImage")}
                onChange={(url) => setValue("coverImage", url, { shouldDirty: true })}
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
          </CardBody>
        </Card>

        {/* Ticket categories */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Ticket categories</h2>
              <p className="text-sm text-gray-500">
                Add one or more ticket tiers (e.g. Regular, VIP)
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                append({
                  name: "",
                  price: 0,
                  totalQuantity: 0,
                  allowInstallments: false,
                  sortOrder: fields.length,
                  installmentPlan: {
                    initialPaymentPercent: 30,
                    gracePeriodDays: 7,
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

          <div className="space-y-4">
            {fields.map((field, index) => (
              <TicketCategoryFields
                key={field.id}
                index={index}
                onRemove={fields.length > 1 ? () => remove(index) : undefined}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pb-8">
          <a href="/seller">
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </a>
          <Button type="submit" loading={isSubmitting}>
            Create event
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
