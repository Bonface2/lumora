import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  publishEvent,
  initiateEventActivationFee,
  initiateEventTierUpgrade,
} from "@/app/actions/events";

// ─── hoisted mocks ───────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  db: {
    event: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
    platformFeeTier: { findUnique: vi.fn() },
    ticketCategory: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn(), findUnique: vi.fn() },
    installmentPlan: { upsert: vi.fn(), delete: vi.fn() },
    installmentScheduleItem: { upsert: vi.fn(), deleteMany: vi.fn() },
    payoutMethod: { findFirst: vi.fn() },
    order: { count: vi.fn() },
    $transaction: vi.fn(),
  },
  initializePayment: vi.fn(),
  generateReference: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/intasend", () => ({
  initializePayment: mocks.initializePayment,
  generateReference: mocks.generateReference,
}));

// ─── helpers ─────────────────────────────────────────────────────────────────

const SELLER_SESSION = {
  user: { id: "seller1", email: "seller@test.com", role: "SELLER" },
};

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "event1",
    sellerId: "seller1",
    title: "Test Event",
    status: "DRAFT",
    eventType: "PAID",
    experienceType: "PUBLIC",
    platformFeePaid: false,
    platformFeeAmount: null,
    attendeeCap: null,
    payoutMethodId: "pm1",
    ticketCategories: [{ id: "cat1", isComplimentary: false }],
    ...overrides,
  };
}

function makeTier(overrides: Record<string, unknown> = {}) {
  return {
    id: "tier1",
    label: "Starter",
    price: 1000,
    maxCap: 20,
    isActive: true,
    ...overrides,
  };
}

// ─── publishEvent ─────────────────────────────────────────────────────────────

describe("publishEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.event.update.mockResolvedValue({});
  });

  it("rejects when unauthenticated", async () => {
    mocks.auth.mockResolvedValue(null);
    const result = await publishEvent("event1");
    expect(result).toEqual({ ok: false, error: "Unauthorized." });
  });

  it("rejects when event has no ticket categories", async () => {
    mocks.auth.mockResolvedValue(SELLER_SESSION);
    mocks.db.event.findFirst.mockResolvedValue(makeEvent({ ticketCategories: [] }));
    const result = await publishEvent("event1");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/ticket category/i);
  });

  it("allows publishing a FREE PUBLIC event", async () => {
    mocks.auth.mockResolvedValue(SELLER_SESSION);
    mocks.db.event.findFirst.mockResolvedValue(
      makeEvent({ eventType: "FREE", experienceType: "PUBLIC" })
    );
    const result = await publishEvent("event1");
    expect(result).toEqual({ ok: true, data: { status: "PUBLISHED" } });
  });

  it("allows publishing a FREE INVITE_ONLY event", async () => {
    mocks.auth.mockResolvedValue(SELLER_SESSION);
    mocks.db.event.findFirst.mockResolvedValue(
      makeEvent({ eventType: "FREE", experienceType: "INVITE_ONLY" })
    );
    const result = await publishEvent("event1");
    expect(result).toEqual({ ok: true, data: { status: "PUBLISHED" } });
  });

  it("allows publishing a FREE GROUP_TRIP event", async () => {
    mocks.auth.mockResolvedValue(SELLER_SESSION);
    mocks.db.event.findFirst.mockResolvedValue(
      makeEvent({ eventType: "FREE", experienceType: "GROUP_TRIP" })
    );
    const result = await publishEvent("event1");
    expect(result).toEqual({ ok: true, data: { status: "PUBLISHED" } });
  });

  it("publishes a PAID event", async () => {
    mocks.auth.mockResolvedValue(SELLER_SESSION);
    mocks.db.event.findFirst.mockResolvedValue(makeEvent({ eventType: "PAID" }));
    const result = await publishEvent("event1");
    expect(result).toEqual({ ok: true, data: { status: "PUBLISHED" } });
    expect(mocks.db.event.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "PUBLISHED" } })
    );
  });

  it("allows publishing a FREE PUBLIC event after the activation fee is paid", async () => {
    mocks.auth.mockResolvedValue(SELLER_SESSION);
    mocks.db.event.findFirst.mockResolvedValue(
      makeEvent({ eventType: "FREE", experienceType: "PUBLIC", platformFeePaid: true })
    );
    const result = await publishEvent("event1");
    expect(result).toEqual({ ok: true, data: { status: "PUBLISHED" } });
  });
});

// ─── initiateEventActivationFee ───────────────────────────────────────────────

describe("initiateEventActivationFee", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateReference.mockReturnValue("ref_act_001");
    mocks.initializePayment.mockResolvedValue({
      ok: true,
      url: "https://sandbox.intasend.com/pay/act123",
      invoiceId: "inv_act123",
    });
  });

  it("rejects non-sellers", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u1", email: "x@x.com", role: "BUYER" } });
    const result = await initiateEventActivationFee("event1", "tier1");
    expect(result).toEqual({ ok: false, error: "Unauthorized." });
  });

  it("rejects when event is not found", async () => {
    mocks.auth.mockResolvedValue(SELLER_SESSION);
    mocks.db.event.findFirst.mockResolvedValue(null);
    mocks.db.platformFeeTier.findUnique.mockResolvedValue(makeTier());
    const result = await initiateEventActivationFee("event1", "tier1");
    expect(result).toEqual({ ok: false, error: "Event not found." });
  });

  it("rejects when event is not a free event", async () => {
    mocks.auth.mockResolvedValue(SELLER_SESSION);
    mocks.db.event.findFirst.mockResolvedValue(makeEvent({ eventType: "PAID" }));
    mocks.db.platformFeeTier.findUnique.mockResolvedValue(makeTier());
    const result = await initiateEventActivationFee("event1", "tier1");
    expect(result).toEqual({ ok: false, error: "This event is not a free event." });
  });

  it("rejects when activation fee has already been paid", async () => {
    mocks.auth.mockResolvedValue(SELLER_SESSION);
    mocks.db.event.findFirst.mockResolvedValue(
      makeEvent({ eventType: "FREE", platformFeePaid: true })
    );
    mocks.db.platformFeeTier.findUnique.mockResolvedValue(makeTier());
    const result = await initiateEventActivationFee("event1", "tier1");
    expect(result).toEqual({ ok: false, error: "Activation fee already paid." });
  });

  it("rejects when selected tier is inactive", async () => {
    mocks.auth.mockResolvedValue(SELLER_SESSION);
    mocks.db.event.findFirst.mockResolvedValue(makeEvent({ eventType: "FREE" }));
    mocks.db.platformFeeTier.findUnique.mockResolvedValue(makeTier({ isActive: false }));
    const result = await initiateEventActivationFee("event1", "tier1");
    expect(result).toEqual({ ok: false, error: "Invalid tier selected." });
  });

  it("rejects when tier does not exist", async () => {
    mocks.auth.mockResolvedValue(SELLER_SESSION);
    mocks.db.event.findFirst.mockResolvedValue(makeEvent({ eventType: "FREE" }));
    mocks.db.platformFeeTier.findUnique.mockResolvedValue(null);
    const result = await initiateEventActivationFee("event1", "tier1");
    expect(result).toEqual({ ok: false, error: "Invalid tier selected." });
  });

  it("charges tier.price in KES", async () => {
    mocks.auth.mockResolvedValue(SELLER_SESSION);
    mocks.db.event.findFirst.mockResolvedValue(makeEvent({ eventType: "FREE" }));
    mocks.db.platformFeeTier.findUnique.mockResolvedValue(makeTier({ price: 2000 }));
    await initiateEventActivationFee("event1", "tier1");
    expect(mocks.initializePayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 2000 })
    );
  });

  it("returns authorization URL and invoice ID on success", async () => {
    mocks.auth.mockResolvedValue(SELLER_SESSION);
    mocks.db.event.findFirst.mockResolvedValue(makeEvent({ eventType: "FREE" }));
    mocks.db.platformFeeTier.findUnique.mockResolvedValue(makeTier());
    const result = await initiateEventActivationFee("event1", "tier1");
    expect(result).toEqual({
      ok: true,
      data: { authorizationUrl: "https://sandbox.intasend.com/pay/act123", invoiceId: "inv_act123" },
    });
  });
});

// ─── initiateEventTierUpgrade ────────────────────────────────────────────────

describe("initiateEventTierUpgrade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateReference.mockReturnValue("ref_upg_001");
    mocks.initializePayment.mockResolvedValue({
      ok: true,
      url: "https://sandbox.intasend.com/pay/upg456",
      invoiceId: "inv_upg456",
    });
  });

  it("rejects non-sellers", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u1", email: "x@x.com", role: "BUYER" } });
    const result = await initiateEventTierUpgrade("event1", "tier2");
    expect(result).toEqual({ ok: false, error: "Unauthorized." });
  });

  it("rejects when event is not found", async () => {
    mocks.auth.mockResolvedValue(SELLER_SESSION);
    mocks.db.event.findFirst.mockResolvedValue(null);
    mocks.db.platformFeeTier.findUnique.mockResolvedValue(makeTier({ price: 2000 }));
    const result = await initiateEventTierUpgrade("event1", "tier2");
    expect(result).toEqual({ ok: false, error: "Event not found." });
  });

  it("rejects when event is not a free event", async () => {
    mocks.auth.mockResolvedValue(SELLER_SESSION);
    mocks.db.event.findFirst.mockResolvedValue(makeEvent({ eventType: "PAID" }));
    mocks.db.platformFeeTier.findUnique.mockResolvedValue(makeTier({ price: 2000 }));
    const result = await initiateEventTierUpgrade("event1", "tier2");
    expect(result).toEqual({ ok: false, error: "This event is not a free event." });
  });

  it("rejects when initial activation has not been completed", async () => {
    mocks.auth.mockResolvedValue(SELLER_SESSION);
    mocks.db.event.findFirst.mockResolvedValue(
      makeEvent({ eventType: "FREE", platformFeePaid: false })
    );
    mocks.db.platformFeeTier.findUnique.mockResolvedValue(makeTier({ price: 2000 }));
    const result = await initiateEventTierUpgrade("event1", "tier2");
    expect(result).toEqual({ ok: false, error: "Please complete the initial activation first." });
  });

  it("rejects when selected tier is not higher than already paid", async () => {
    mocks.auth.mockResolvedValue(SELLER_SESSION);
    mocks.db.event.findFirst.mockResolvedValue(
      makeEvent({ eventType: "FREE", platformFeePaid: true, platformFeeAmount: 2000 })
    );
    mocks.db.platformFeeTier.findUnique.mockResolvedValue(makeTier({ price: 1000 })); // lower tier
    const result = await initiateEventTierUpgrade("event1", "tier2");
    expect(result).toEqual({ ok: false, error: "You are already on this tier or higher." });
  });

  it("rejects when selected tier equals the already paid amount", async () => {
    mocks.auth.mockResolvedValue(SELLER_SESSION);
    mocks.db.event.findFirst.mockResolvedValue(
      makeEvent({ eventType: "FREE", platformFeePaid: true, platformFeeAmount: 2000 })
    );
    mocks.db.platformFeeTier.findUnique.mockResolvedValue(makeTier({ price: 2000 })); // same tier
    const result = await initiateEventTierUpgrade("event1", "tier2");
    expect(result).toEqual({ ok: false, error: "You are already on this tier or higher." });
  });

  it("charges only the difference between tiers in KES", async () => {
    mocks.auth.mockResolvedValue(SELLER_SESSION);
    mocks.db.event.findFirst.mockResolvedValue(
      makeEvent({ eventType: "FREE", platformFeePaid: true, platformFeeAmount: 1000 })
    );
    mocks.db.platformFeeTier.findUnique.mockResolvedValue(makeTier({ price: 3000, maxCap: 100 }));
    await initiateEventTierUpgrade("event1", "tier2");
    // 3000 - 1000 = 2000 KES
    expect(mocks.initializePayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 2000 })
    );
  });

  it("returns authorization URL and invoice ID on success", async () => {
    mocks.auth.mockResolvedValue(SELLER_SESSION);
    mocks.db.event.findFirst.mockResolvedValue(
      makeEvent({ eventType: "FREE", platformFeePaid: true, platformFeeAmount: 1000 })
    );
    mocks.db.platformFeeTier.findUnique.mockResolvedValue(makeTier({ price: 2000 }));
    const result = await initiateEventTierUpgrade("event1", "tier2");
    expect(result).toEqual({
      ok: true,
      data: { authorizationUrl: "https://sandbox.intasend.com/pay/upg456", invoiceId: "inv_upg456" },
    });
  });

  it("marks the payment as an upgrade via the reference prefix", async () => {
    mocks.auth.mockResolvedValue(SELLER_SESSION);
    mocks.db.event.findFirst.mockResolvedValue(
      makeEvent({ eventType: "FREE", platformFeePaid: true, platformFeeAmount: 1000 })
    );
    mocks.db.platformFeeTier.findUnique.mockResolvedValue(makeTier({ price: 2000 }));
    await initiateEventTierUpgrade("event1", "tier2");
    expect(mocks.generateReference).toHaveBeenCalledWith("UPG");
  });
});
