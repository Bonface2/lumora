import { describe, it, expect, beforeEach, vi } from "vitest";
import { createOrder } from "@/app/actions/orders";

// ─── hoisted mocks (available inside vi.mock factories) ─────────────────────

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  db: {
    ticketCategory: { findUnique: vi.fn(), aggregate: vi.fn() },
    order: { create: vi.fn(), delete: vi.fn() },
    user: { findUniqueOrThrow: vi.fn() },
    installmentPayment: { create: vi.fn() },
    paystackTransaction: { create: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
  initializePayment: vi.fn(),
  generateReference: vi.fn(),
  toKobo: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/paystack", () => ({
  initializePayment: mocks.initializePayment,
  generateReference: mocks.generateReference,
  toKobo: mocks.toKobo,
}));

// ─── test helpers ────────────────────────────────────────────────────────────

const SESSION = { user: { id: "user1", email: "buyer@test.com" } };

function makeCategory(overrides: Record<string, unknown> = {}) {
  return {
    id: "cat1",
    name: "Regular",
    price: 1000,
    totalQuantity: 50,
    soldQuantity: 10,
    allowInstallments: false,
    installmentPlan: null,
    isComplimentary: false,
    eventId: "event1",
    event: {
      id: "event1",
      status: "PUBLISHED",
      eventType: "PAID",
      experienceType: "PUBLIC",
      attendeeCap: null,
    },
    ...overrides,
  };
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe("createOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateReference.mockReturnValue("ref_test_001");
    mocks.toKobo.mockImplementation((n: number) => n * 100);
    mocks.db.$transaction.mockImplementation(
      async (fn: (tx: typeof mocks.db) => Promise<unknown>) => fn(mocks.db)
    );
    mocks.db.order.create.mockResolvedValue({ id: "order1" });
    mocks.db.installmentPayment.create.mockResolvedValue({});
    mocks.db.paystackTransaction.create.mockResolvedValue({});
    mocks.db.user.findUniqueOrThrow.mockResolvedValue({ email: "buyer@test.com" });
    mocks.initializePayment.mockResolvedValue({
      status: true,
      data: { authorization_url: "https://paystack.com/pay/abc" },
    });
  });

  it("rejects unauthenticated requests", async () => {
    mocks.auth.mockResolvedValue(null);
    const result = await createOrder({ ticketCategoryId: "cat1", useInstallments: false });
    expect(result).toEqual({ ok: false, error: "Please sign in to continue." });
  });

  it("rejects when ticket category does not exist", async () => {
    mocks.auth.mockResolvedValue(SESSION);
    mocks.db.ticketCategory.findUnique.mockResolvedValue(null);
    const result = await createOrder({ ticketCategoryId: "cat1", useInstallments: false });
    expect(result).toEqual({ ok: false, error: "Ticket category not found." });
  });

  it("rejects when event is not published", async () => {
    mocks.auth.mockResolvedValue(SESSION);
    mocks.db.ticketCategory.findUnique.mockResolvedValue(
      makeCategory({ event: { id: "event1", status: "DRAFT", eventType: "PAID", experienceType: "PUBLIC", attendeeCap: null } })
    );
    const result = await createOrder({ ticketCategoryId: "cat1", useInstallments: false });
    expect(result).toEqual({ ok: false, error: "This event is not available." });
  });

  it("rejects when category is completely sold out", async () => {
    mocks.auth.mockResolvedValue(SESSION);
    mocks.db.ticketCategory.findUnique.mockResolvedValue(
      makeCategory({ totalQuantity: 10, soldQuantity: 10 })
    );
    const result = await createOrder({ ticketCategoryId: "cat1", useInstallments: false });
    expect(result).toEqual({ ok: false, error: "This ticket category is sold out." });
  });

  it("rejects when requested quantity exceeds remaining tickets", async () => {
    mocks.auth.mockResolvedValue(SESSION);
    mocks.db.ticketCategory.findUnique.mockResolvedValue(
      makeCategory({ totalQuantity: 12, soldQuantity: 10 }) // 2 remaining
    );
    const result = await createOrder({ ticketCategoryId: "cat1", useInstallments: false, quantity: 5 });
    expect(result).toEqual({ ok: false, error: "Only 2 tickets remaining." });
  });

  describe("free event attendee cap", () => {
    const freeEvent = {
      id: "event1",
      status: "PUBLISHED",
      eventType: "FREE",
      experienceType: "PUBLIC",
      attendeeCap: 20,
    };

    it("blocks registration when cap is fully reached", async () => {
      mocks.auth.mockResolvedValue(SESSION);
      mocks.db.ticketCategory.findUnique.mockResolvedValue(makeCategory({ event: freeEvent }));
      mocks.db.ticketCategory.aggregate.mockResolvedValue({ _sum: { soldQuantity: 20 } });
      const result = await createOrder({ ticketCategoryId: "cat1", useInstallments: false });
      expect(result.ok).toBe(false);
      expect(!result.ok && result.error).toMatch(/registration limit/i);
    });

    it("blocks when requested quantity would exceed remaining capacity", async () => {
      mocks.auth.mockResolvedValue(SESSION);
      mocks.db.ticketCategory.findUnique.mockResolvedValue(makeCategory({ event: freeEvent }));
      mocks.db.ticketCategory.aggregate.mockResolvedValue({ _sum: { soldQuantity: 18 } }); // 2 spots left
      const result = await createOrder({ ticketCategoryId: "cat1", useInstallments: false, quantity: 5 });
      expect(result.ok).toBe(false);
      expect(!result.ok && result.error).toMatch(/2 spots left/i);
    });

    it("allows registration when within remaining capacity", async () => {
      mocks.auth.mockResolvedValue(SESSION);
      mocks.db.ticketCategory.findUnique.mockResolvedValue(makeCategory({ event: freeEvent }));
      mocks.db.ticketCategory.aggregate.mockResolvedValue({ _sum: { soldQuantity: 15 } }); // 5 spots left
      const result = await createOrder({ ticketCategoryId: "cat1", useInstallments: false, quantity: 3 });
      expect(result.ok).toBe(true);
    });

    it("skips cap check when attendeeCap is null", async () => {
      mocks.auth.mockResolvedValue(SESSION);
      mocks.db.ticketCategory.findUnique.mockResolvedValue(
        makeCategory({ event: { ...freeEvent, attendeeCap: null } })
      );
      const result = await createOrder({ ticketCategoryId: "cat1", useInstallments: false });
      expect(mocks.db.ticketCategory.aggregate).not.toHaveBeenCalled();
      expect(result.ok).toBe(true);
    });
  });

  it("rejects when installments requested but not enabled for the category", async () => {
    mocks.auth.mockResolvedValue(SESSION);
    mocks.db.ticketCategory.findUnique.mockResolvedValue(
      makeCategory({ allowInstallments: false })
    );
    const result = await createOrder({ ticketCategoryId: "cat1", useInstallments: true });
    expect(result).toEqual({ ok: false, error: "Installments are not available for this ticket." });
  });

  it("returns payment URL on success", async () => {
    mocks.auth.mockResolvedValue(SESSION);
    mocks.db.ticketCategory.findUnique.mockResolvedValue(makeCategory());
    const result = await createOrder({ ticketCategoryId: "cat1", useInstallments: false });
    expect(result).toEqual({ ok: true, data: { paymentUrl: "https://paystack.com/pay/abc" } });
  });

  it("charges the full total for multi-quantity PAID orders", async () => {
    mocks.auth.mockResolvedValue(SESSION);
    mocks.db.ticketCategory.findUnique.mockResolvedValue(
      makeCategory({ price: 2500, totalQuantity: 50, soldQuantity: 5 })
    );
    await createOrder({ ticketCategoryId: "cat1", useInstallments: false, quantity: 2 });
    // 2500 * 2 = 5000, toKobo = 500000
    expect(mocks.initializePayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 500000 })
    );
  });

  it("charges only the initial installment percentage on first payment", async () => {
    const installmentPlan = {
      id: "plan1",
      initialPaymentPercent: 30,
      scheduleItems: [
        { id: "s1", installmentNumber: 1, percentage: 40, dueDate: new Date(Date.now() + 86_400_000) },
        { id: "s2", installmentNumber: 2, percentage: 30, dueDate: new Date(Date.now() + 86_400_000 * 2) },
      ],
    };
    mocks.auth.mockResolvedValue(SESSION);
    mocks.db.ticketCategory.findUnique.mockResolvedValue(
      makeCategory({ price: 1000, allowInstallments: true, installmentPlan })
    );
    await createOrder({ ticketCategoryId: "cat1", useInstallments: true });
    // 30% of 1000 = 300, toKobo = 30000
    expect(mocks.initializePayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 30000 })
    );
  });

  it("rolls up past-due schedule items into the initial charge", async () => {
    const installmentPlan = {
      id: "plan1",
      initialPaymentPercent: 30,
      scheduleItems: [
        { id: "s1", installmentNumber: 1, percentage: 20, dueDate: new Date(Date.now() - 86_400_000) }, // past due
        { id: "s2", installmentNumber: 2, percentage: 50, dueDate: new Date(Date.now() + 86_400_000) },
      ],
    };
    mocks.auth.mockResolvedValue(SESSION);
    mocks.db.ticketCategory.findUnique.mockResolvedValue(
      makeCategory({ price: 1000, allowInstallments: true, installmentPlan })
    );
    await createOrder({ ticketCategoryId: "cat1", useInstallments: true });
    // 30% initial + 20% past-due = 50% of 1000 = 500, toKobo = 50000
    expect(mocks.initializePayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 50000 })
    );
  });

  it("deletes the order if Paystack initialization fails", async () => {
    mocks.auth.mockResolvedValue(SESSION);
    mocks.db.ticketCategory.findUnique.mockResolvedValue(makeCategory());
    mocks.initializePayment.mockResolvedValue({ status: false, data: {} });
    const result = await createOrder({ ticketCategoryId: "cat1", useInstallments: false });
    expect(result.ok).toBe(false);
    expect(mocks.db.order.delete).toHaveBeenCalledWith({ where: { id: "order1" } });
  });
});
