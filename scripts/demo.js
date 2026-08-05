/**
 * Lumora Client Demo — Live Purchase Simulation
 *
 * Simulates real ticket purchases at a controlled rate across multiple buyer
 * email accounts. Each purchase creates a real order and sends a real ticket
 * confirmation email. Mix of full-payment and installment orders.
 *
 * Prerequisites:
 *   - LOAD_TEST_MODE=true on the server
 *   - LOAD_TEST_SECRET set on the server
 *   - The 3 buyer emails must be registered Lumora accounts
 *   - The ticket category must belong to a PUBLISHED event
 *   - Node.js 18+ (uses built-in fetch)
 *
 * Usage:
 *   BASE_URL=https://lumora.co.ke \
 *   TICKET_CATEGORY_ID=<id> \
 *   LOAD_TEST_SECRET=<secret> \
 *   BUYER_EMAILS=alice@gmail.com,bob@gmail.com,carol@gmail.com \
 *   node scripts/demo.js
 *
 * Optional env vars (with defaults):
 *   PURCHASES_PER_MINUTE=6    how many purchases to fire per minute
 *   DURATION_MINUTES=5        how long to run
 *   INSTALLMENT_RATIO=0.4     fraction of purchases that use installments (0–1)
 *   QUANTITY_PER_PURCHASE=1   tickets per purchase
 */

// ── Config ────────────────────────────────────────────────────────────────────

const BASE_URL           = process.env.BASE_URL            || "http://localhost:3000";
const SECRET             = process.env.LOAD_TEST_SECRET;
const TICKET_CATEGORY_ID = process.env.TICKET_CATEGORY_ID;
const BUYER_EMAILS       = (process.env.BUYER_EMAILS || "").split(",").map((e) => e.trim()).filter(Boolean);
const PPM                = Number(process.env.PURCHASES_PER_MINUTE  || 6);
const DURATION           = Number(process.env.DURATION_MINUTES       || 5);
const INSTALL_RATIO      = Number(process.env.INSTALLMENT_RATIO      || 0.4);
const QTY                = Math.max(1, Number(process.env.QUANTITY_PER_PURCHASE || 1));

// ── Validation ────────────────────────────────────────────────────────────────

const missing = [];
if (!SECRET)             missing.push("LOAD_TEST_SECRET");
if (!TICKET_CATEGORY_ID) missing.push("TICKET_CATEGORY_ID");
if (!BUYER_EMAILS.length) missing.push("BUYER_EMAILS");

if (missing.length) {
  console.error(`\nMissing required env vars: ${missing.join(", ")}\n`);
  process.exit(1);
}

// ── State ─────────────────────────────────────────────────────────────────────

const TOTAL        = PPM * DURATION;
const INTERVAL_MS  = Math.round(60_000 / PPM);

let attempted  = 0;
let succeeded  = 0;
let soldOut    = 0;
let errored    = 0;
let emailIndex = 0;
let running    = true;

// ── Helpers ───────────────────────────────────────────────────────────────────

function nextEmail() {
  return BUYER_EMAILS[emailIndex++ % BUYER_EMAILS.length];
}

function ts() {
  return new Date().toLocaleTimeString("en-KE", { hour12: false });
}

function bar(done, total, width = 30) {
  const filled = Math.round((done / total) * width);
  return "[" + "█".repeat(filled) + "░".repeat(width - filled) + "]";
}

function pad(str, len) {
  return String(str).padEnd(len);
}

async function purchase() {
  const email          = nextEmail();
  const useInstallments = Math.random() < INSTALL_RATIO;
  const n              = ++attempted;

  let res, data;
  try {
    res  = await fetch(`${BASE_URL}/api/load-test`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "x-load-test-secret": SECRET },
      body:    JSON.stringify({ ticketCategoryId: TICKET_CATEGORY_ID, quantity: QTY, buyerEmail: email, useInstallments }),
      signal:  AbortSignal.timeout(15_000),
    });
    data = await res.json();
  } catch (err) {
    errored++;
    console.log(`  [${ts()}] ${bar(n, TOTAL)}  #${n}/${TOTAL}  ✗ NETWORK — ${err.message}`);
    return;
  }

  if (res.status === 409 || data?.error === "Sold out.") {
    soldOut++;
    console.log(`  [${ts()}] ${bar(n, TOTAL)}  #${n}/${TOTAL}  ⊘ SOLD OUT`);
    if (soldOut >= 3) {
      console.log("\n  All tickets sold out — stopping early.\n");
      running = false;
    }
    return;
  }

  if (!data?.ok) {
    errored++;
    console.log(`  [${ts()}] ${bar(n, TOTAL)}  #${n}/${TOTAL}  ✗ ERROR — ${data?.error ?? res.status}`);
    return;
  }

  succeeded++;
  const type    = data.type === "installment" ? "installment 💳" : "full pay     ";
  const tickets = data.ticketNumbers?.length ? data.ticketNumbers.join(" · ") : "—";
  console.log(`  [${ts()}] ${bar(n, TOTAL)}  #${n}/${TOTAL}  ✓ ${pad(email, 28)} [${type}]  ${tickets}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log();
console.log("  ╔══════════════════════════════════════════════════════════╗");
console.log("  ║            Lumora — Live Purchase Demo                  ║");
console.log("  ╚══════════════════════════════════════════════════════════╝");
console.log();
console.log(`  Target      ${BASE_URL}`);
console.log(`  Category    ${TICKET_CATEGORY_ID}`);
console.log(`  Buyers      ${BUYER_EMAILS.join("  |  ")}`);
console.log(`  Rate        ${PPM} purchases / min  (every ${INTERVAL_MS / 1000}s)`);
console.log(`  Duration    ${DURATION} min  →  ${TOTAL} total purchases`);
console.log(`  Mix         ${Math.round(INSTALL_RATIO * 100)}% installment / ${Math.round((1 - INSTALL_RATIO) * 100)}% full pay`);
console.log();
console.log("  Starting in 3 seconds… (Ctrl-C to stop early)");
console.log();

await new Promise((r) => setTimeout(r, 3_000));

const timer = setInterval(async () => {
  if (!running || attempted >= TOTAL) {
    clearInterval(timer);

    console.log();
    console.log("  ╔══════════════════════════════════════════════════════════╗");
    console.log("  ║                      Summary                            ║");
    console.log("  ╚══════════════════════════════════════════════════════════╝");
    console.log();
    console.log(`  Attempted   ${attempted}`);
    console.log(`  Succeeded   ${succeeded}  (emails sent)`);
    console.log(`  Sold out    ${soldOut}`);
    console.log(`  Errors      ${errored}`);
    console.log();
    console.log("  Emails should be arriving in the 3 inboxes now.");
    console.log("  Remember to disable LOAD_TEST_MODE on the server when done.");
    console.log();
    return;
  }

  await purchase();
}, INTERVAL_MS);
