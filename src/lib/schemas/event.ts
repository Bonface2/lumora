import { z } from "zod";

export const installmentItemSchema = z.object({
  installmentNumber: z.number(),
  percentage: z.number().min(1, "Must be at least 1%").max(99),
  dueDate: z.string().min(1, "Due date is required"),
});

export const installmentPlanSchema = z.object({
  initialPaymentPercent: z.number().min(1, "Required").max(99),
  gracePeriodDays: z.number().min(1),
  enforceRevocation: z.boolean(),
  graceOverridesEventCutoff: z.boolean(),
  scheduleItems: z.array(installmentItemSchema),
});

export const ticketCategorySchema = z.object({
  id: z.string().optional(), // present when editing an existing category
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.number().min(0, "Price must be 0 or greater"),
  totalQuantity: z.number().min(1, "Quantity must be at least 1"),
  allowInstallments: z.boolean(),
  sortOrder: z.number(),
  installmentPlan: installmentPlanSchema.optional(),
});

const eventBaseSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  date: z.string().min(1, "Event date is required"),
  endDate: z.string().optional(),
  venue: z.string().min(2, "Venue is required"),
  city: z.string().optional(),
  coverImage: z.string().optional(),
  payoutMethodId: z.string().optional(),
  eventType: z.enum(["FREE", "PAID"]),
  experienceType: z.enum(["PUBLIC", "INVITE_ONLY", "GROUP_TRIP"]),
  isPrivate: z.boolean(),
  ticketCategories: z
    .array(ticketCategorySchema)
    .min(1, "Add at least one ticket category"),
});

function installmentDateRefinement(
  data: z.infer<typeof eventBaseSchema>,
  ctx: z.RefinementCtx,
  todayStr: string
) {
  if (!data.date) return;
  const eventStart = new Date(data.date);
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
  const eventDateStr = data.date.slice(0, 10);
  data.ticketCategories.forEach((cat, catIdx) => {
    if (!cat.allowInstallments || !cat.installmentPlan) return;
    if (cat.installmentPlan.scheduleItems.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add at least one installment",
        path: ["ticketCategories", catIdx, "installmentPlan", "scheduleItems"],
      });
      return;
    }
    let prevDueDate = "";
    let latestDueDate = "";
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
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Due date cannot be in the past", path });
      } else if (item.dueDate > eventDateStr) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Due date cannot be after the event date", path });
      } else if (prevDueDate && item.dueDate <= prevDueDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Due date must be after the previous installment", path });
      }
      prevDueDate = item.dueDate;
      if (item.dueDate > latestDueDate) latestDueDate = item.dueDate;
    });

    // Grace period must not push past the event date
    if (cat.installmentPlan.enforceRevocation && latestDueDate && cat.installmentPlan.gracePeriodDays) {
      const eventDate = new Date(data.date);
      const dueDate = new Date(latestDueDate);
      const maxGrace = Math.floor((eventDate.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
      if (cat.installmentPlan.gracePeriodDays > maxGrace) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Grace period cannot extend past the event date. Maximum ${maxGrace} day(s) based on your latest due date.`,
          path: ["ticketCategories", catIdx, "installmentPlan", "gracePeriodDays"],
        });
      }
    }
  });
}

export const createEventSchema = eventBaseSchema.superRefine((data, ctx) => {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  if (data.date) {
    const eventStart = new Date(data.date);
    if (eventStart <= now) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Event start date must be in the future",
        path: ["date"],
      });
    }
  }

  // PAID events require a payout method
  if (data.eventType === "PAID" && !data.payoutMethodId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select a payout method",
      path: ["payoutMethodId"],
    });
  }

  // FREE events: all prices must be 0 and no installments
  if (data.eventType === "FREE") {
    data.ticketCategories.forEach((cat, catIdx) => {
      if (cat.price !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Free event ticket prices must be 0",
          path: ["ticketCategories", catIdx, "price"],
        });
      }
      if (cat.allowInstallments) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Free events cannot have installments",
          path: ["ticketCategories", catIdx, "allowInstallments"],
        });
      }
    });
  }

  installmentDateRefinement(data, ctx, todayStr);
});

// Edit variant: same checks but no "must be future" constraint on start date
// so sellers can edit events that are happening today or are ongoing.
export const editEventSchema = eventBaseSchema.superRefine((data, ctx) => {
  const todayStr = new Date().toISOString().slice(0, 10);

  // PAID events require a payout method
  if (data.eventType === "PAID" && !data.payoutMethodId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select a payout method",
      path: ["payoutMethodId"],
    });
  }

  // FREE events: all prices must be 0 and no installments
  if (data.eventType === "FREE") {
    data.ticketCategories.forEach((cat, catIdx) => {
      if (cat.price !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Free event ticket prices must be 0",
          path: ["ticketCategories", catIdx, "price"],
        });
      }
      if (cat.allowInstallments) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Free events cannot have installments",
          path: ["ticketCategories", catIdx, "allowInstallments"],
        });
      }
    });
  }

  installmentDateRefinement(data, ctx, todayStr);
});

// With no .default() calls, input and output types are identical — no mismatch.
export type CreateEventFormData = z.infer<typeof createEventSchema>;
