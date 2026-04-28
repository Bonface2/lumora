import { z } from "zod";

export const installmentItemSchema = z.object({
  installmentNumber: z.number(),
  percentage: z.number().min(1, "Must be at least 1%").max(99),
  dueDate: z.string().min(1, "Due date is required"),
});

export const installmentPlanSchema = z.object({
  initialPaymentPercent: z.number().min(1, "Required").max(99),
  gracePeriodDays: z.number().min(1),
  scheduleItems: z
    .array(installmentItemSchema)
    .min(1, "Add at least one installment"),
});

export const ticketCategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.number().min(1, "Price must be greater than 0"),
  totalQuantity: z.number().min(1, "Quantity must be at least 1"),
  allowInstallments: z.boolean(),
  sortOrder: z.number(),
  installmentPlan: installmentPlanSchema.optional(),
});

export const createEventSchema = z
  .object({
    title: z.string().min(3, "Title must be at least 3 characters"),
    description: z.string().min(20, "Description must be at least 20 characters"),
    date: z.string().min(1, "Event date is required"),
    endDate: z.string().optional(),
    venue: z.string().min(2, "Venue is required"),
    city: z.string().optional(),
    coverImage: z.string().optional(),
    ticketCategories: z
      .array(ticketCategorySchema)
      .min(1, "Add at least one ticket category"),
  })
  .superRefine((data, ctx) => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10); // "YYYY-MM-DD"

    // Start date must be in the future
    if (data.date) {
      const eventStart = new Date(data.date);
      if (eventStart <= now) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Event start date must be in the future",
          path: ["date"],
        });
      }

      // End date must be after start date
      if (data.endDate) {
        const eventEnd = new Date(data.endDate);
        if (eventEnd <= eventStart) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "End date must be after the start date",
            path: ["endDate"],
          });
        }
      }

      // Installment due date validations
      const eventDateStr = data.date.slice(0, 10);
      data.ticketCategories.forEach((cat, catIdx) => {
        if (!cat.allowInstallments || !cat.installmentPlan) return;
        let prevDueDate = "";
        cat.installmentPlan.scheduleItems.forEach((item, itemIdx) => {
          if (!item.dueDate) return;
          const path = [
            "ticketCategories",
            catIdx,
            "installmentPlan",
            "scheduleItems",
            itemIdx,
            "dueDate",
          ];

          if (item.dueDate < todayStr) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Due date cannot be in the past",
              path,
            });
          } else if (item.dueDate >= eventDateStr) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Due date must be before the event date",
              path,
            });
          } else if (prevDueDate && item.dueDate <= prevDueDate) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Due date must be after the previous installment",
              path,
            });
          }
          prevDueDate = item.dueDate;
        });
      });
    }
  });

// With no .default() calls, input and output types are identical — no mismatch.
export type CreateEventFormData = z.infer<typeof createEventSchema>;
