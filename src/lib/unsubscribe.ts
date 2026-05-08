import { createHmac } from "crypto";

export function getUnsubscribeToken(userId: string): string {
  return createHmac("sha256", process.env.NEXTAUTH_SECRET!)
    .update(userId)
    .digest("hex")
    .slice(0, 32);
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  return getUnsubscribeToken(userId) === token;
}
