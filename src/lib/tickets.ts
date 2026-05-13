import crypto from "crypto";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 chars — divides 256 evenly, no modulo bias

export function generateTicketNumber(prefix: string): string {
  const bytes = crypto.randomBytes(8);
  const random = Array.from(bytes, (b) => CHARS[b % CHARS.length]).join("");
  return `${prefix}-${random}`;
}

export function eventTitlePrefix(title: string): string {
  return title.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 4);
}
