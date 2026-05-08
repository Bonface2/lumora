import crypto from "crypto";

interface ScanTokenPayload {
  eventId: string;
  exp: number; // unix ms
}

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET not set");
  return s;
}

export function createScanToken(eventId: string, expiresAt: Date): string {
  const payload: ScanTokenPayload = { eventId, exp: expiresAt.getTime() };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", secret())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyScanToken(token: string): ScanTokenPayload | null {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const encoded = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto
    .createHmac("sha256", secret())
    .update(encoded)
    .digest("base64url");
  if (sig !== expected) return null;
  let payload: ScanTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString());
  } catch {
    return null;
  }
  if (Date.now() > payload.exp) return null;
  return payload;
}
