/**
 * Lumora Load Test — k6
 *
 * Usage:
 *   k6 run -e BASE_URL=https://yourdomain.com \
 *          -e TICKET_CATEGORY_ID=<id> \
 *          -e LOAD_TEST_SECRET=<secret> \
 *          --scenario smoke \
 *          scripts/load-test.js
 *
 * Scenarios (pass --scenario <name> or omit to run all):
 *   smoke        — 1 VU, 10 iterations. Quick sanity check.
 *   average_load — Ramp to 20 VUs, hold 2 min, ramp down. Baseline throughput.
 *   spike        — Burst to 100 VUs for 10 s. Race condition / oversell test.
 *   soak         — 10 VUs for 10 min. Memory leak / connection pool check.
 *
 * Prerequisites on server:
 *   sudo snap install k6          # or: brew install k6 (local)
 *   # In .env on the server:
 *   LOAD_TEST_MODE=true
 *   LOAD_TEST_SECRET=<a long random string>
 *
 * After testing:
 *   # Remove test orders created by load-test@lumora.internal:
 *   psql $DATABASE_URL -c "
 *     DELETE FROM \"Ticket\" WHERE \"orderId\" IN (
 *       SELECT id FROM \"Order\" WHERE \"buyerId\" = (
 *         SELECT id FROM \"User\" WHERE email = 'load-test@lumora.internal'
 *       )
 *     );
 *     DELETE FROM \"InstallmentPayment\" WHERE \"orderId\" IN (
 *       SELECT id FROM \"Order\" WHERE \"buyerId\" = (
 *         SELECT id FROM \"User\" WHERE email = 'load-test@lumora.internal'
 *       )
 *     );
 *     DELETE FROM \"Order\" WHERE \"buyerId\" = (
 *       SELECT id FROM \"User\" WHERE email = 'load-test@lumora.internal'
 *     );
 *   "
 *   # Also reset soldQuantity if needed:
 *   # UPDATE \"TicketCategory\" SET \"soldQuantity\" = 0 WHERE id = '<id>';
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

// ── Config ────────────────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const TICKET_CATEGORY_ID = __ENV.TICKET_CATEGORY_ID;
const LOAD_TEST_SECRET = __ENV.LOAD_TEST_SECRET;

if (!TICKET_CATEGORY_ID) throw new Error("TICKET_CATEGORY_ID env var is required.");
if (!LOAD_TEST_SECRET) throw new Error("LOAD_TEST_SECRET env var is required.");

// ── Custom metrics ────────────────────────────────────────────────────────────

const purchaseDuration = new Trend("purchase_duration_ms", true);
const pageLoadDuration = new Trend("page_load_duration_ms", true);
const purchaseSuccessRate = new Rate("purchase_success_rate");
const soldOutCount = new Counter("sold_out_count");

// ── Scenarios ─────────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    smoke: {
      executor: "shared-iterations",
      vus: 1,
      iterations: 10,
      maxDuration: "30s",
      tags: { scenario: "smoke" },
    },

    average_load: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 20 },   // ramp up
        { duration: "2m", target: 20 },    // hold
        { duration: "20s", target: 0 },    // ramp down
      ],
      startTime: "35s",                    // after smoke finishes
      tags: { scenario: "average_load" },
    },

    spike: {
      executor: "shared-iterations",
      vus: 100,
      iterations: 100,                     // all 100 VUs hit the endpoint at once
      maxDuration: "30s",
      startTime: "4m",                     // after average_load settles
      tags: { scenario: "spike" },
    },

    soak: {
      executor: "constant-vus",
      vus: 10,
      duration: "10m",
      startTime: "5m",
      tags: { scenario: "soak" },
    },
  },

  thresholds: {
    // 95% of purchase requests must complete under 3 s
    purchase_duration_ms: ["p(95)<3000"],
    // 95% of page loads under 2 s
    page_load_duration_ms: ["p(95)<2000"],
    // At most 2% of purchase attempts should error (sold-out is not an error)
    purchase_success_rate: ["rate>0.98"],
    // HTTP error rate
    http_req_failed: ["rate<0.02"],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const PURCHASE_URL = `${BASE_URL}/api/load-test`;
const EVENT_PAGE_URL = `${BASE_URL}/events`;

const purchaseHeaders = {
  "Content-Type": "application/json",
  "x-load-test-secret": LOAD_TEST_SECRET,
};

function attemptPurchase(quantity = 1) {
  const payload = JSON.stringify({ ticketCategoryId: TICKET_CATEGORY_ID, quantity });
  const start = Date.now();
  const res = http.post(PURCHASE_URL, payload, { headers: purchaseHeaders, timeout: "10s" });
  purchaseDuration.add(Date.now() - start);

  const ok = res.status === 200;
  const body = res.json();

  if (res.status === 409 || (body && body.error === "Sold out.")) {
    soldOutCount.add(1);
    purchaseSuccessRate.add(true); // sold-out is expected behavior, not a failure
    return { soldOut: true };
  }

  const passed = check(res, {
    "purchase: status 200": (r) => r.status === 200,
    "purchase: ok true": () => ok && body && body.ok === true,
    "purchase: has orderId": () => ok && body && !!body.orderId,
  });

  purchaseSuccessRate.add(passed);
  return { ok: passed, orderId: body?.orderId };
}

function loadEventPage() {
  const start = Date.now();
  const res = http.get(EVENT_PAGE_URL, { timeout: "10s" });
  pageLoadDuration.add(Date.now() - start);

  check(res, {
    "events page: status 200": (r) => r.status === 200,
  });
}

// ── Default function ──────────────────────────────────────────────────────────

export default function () {
  const scenario = __ENV.K6_SCENARIO_NAME || "";

  if (scenario === "spike") {
    // Pure concurrent purchase burst — no sleeps, maximum contention
    attemptPurchase(1);
    return;
  }

  // For other scenarios: mix of page loads and purchases to simulate real traffic
  const roll = Math.random();

  if (roll < 0.3) {
    // 30%: page browse only
    loadEventPage();
    sleep(Math.random() * 2 + 0.5);
  } else if (roll < 0.7) {
    // 40%: page load then purchase
    loadEventPage();
    sleep(Math.random() * 1 + 0.3);
    attemptPurchase(1);
    sleep(Math.random() * 2 + 1);
  } else {
    // 30%: purchase only (existing user, no page browse)
    attemptPurchase(1);
    sleep(Math.random() * 1.5 + 0.5);
  }
}
