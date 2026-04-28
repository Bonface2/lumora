import type {
  User,
  Event,
  TicketCategory,
  InstallmentPlan,
  InstallmentScheduleItem,
  Order,
  Ticket,
  InstallmentPayment,
  PaystackTransaction,
  ResaleListing,
  Role,
  EventStatus,
  OrderStatus,
  TicketStatus,
  InstallmentPaymentStatus,
  ResaleListingStatus,
} from "@prisma/client";

export type {
  User,
  Event,
  TicketCategory,
  InstallmentPlan,
  InstallmentScheduleItem,
  Order,
  Ticket,
  InstallmentPayment,
  PaystackTransaction,
  ResaleListing,
  Role,
  EventStatus,
  OrderStatus,
  TicketStatus,
  InstallmentPaymentStatus,
  ResaleListingStatus,
};

// ─── Extended / Composed Types ────────────────────────────────────────────────

export type EventWithCategories = Event & {
  ticketCategories: (TicketCategory & {
    installmentPlan:
      | (InstallmentPlan & { scheduleItems: InstallmentScheduleItem[] })
      | null;
  })[];
  seller: Pick<User, "id" | "name" | "email">;
};

export type OrderWithDetails = Order & {
  buyer: Pick<User, "id" | "name" | "email" | "phone">;
  ticketCategory: TicketCategory & { event: Event };
  tickets: Ticket[];
  payments: InstallmentPayment[];
};

export type DefaultingOrder = OrderWithDetails & {
  nextPayment: InstallmentPayment;
  daysOverdue: number;
};

// ─── API Response Helpers ─────────────────────────────────────────────────────

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiError = { ok: false; error: string };
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export function apiSuccess<T>(data: T): ApiSuccess<T> {
  return { ok: true, data };
}

export function apiError(error: string): ApiError {
  return { ok: false, error };
}
