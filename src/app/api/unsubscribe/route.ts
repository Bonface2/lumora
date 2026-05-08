import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("uid");
  const token = req.nextUrl.searchParams.get("token");

  if (!userId || !token || !verifyUnsubscribeToken(userId, token)) {
    return new NextResponse("Invalid unsubscribe link.", { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    return new NextResponse("User not found.", { status: 404 });
  }

  if (!user.marketingEmails) {
    return new NextResponse(unsubscribePage("You are already unsubscribed from marketing emails."), {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  }

  await db.user.update({ where: { id: userId }, data: { marketingEmails: false } });

  return new NextResponse(unsubscribePage("You have been unsubscribed from Lumora marketing emails."), {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

function unsubscribePage(message: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Unsubscribed — Lumora</title>
  <style>
    body { margin:0; padding:0; background:#f1f5f9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { background:#fff; border-radius:16px; padding:40px 48px; max-width:420px; text-align:center; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
    .logo { display:inline-flex; align-items:center; gap:8px; margin-bottom:24px; }
    .logo-mark { background:#0f9699; border-radius:8px; width:32px; height:32px; color:#fff; font-weight:900; font-size:16px; display:flex; align-items:center; justify-content:center; }
    .logo-name { font-size:18px; font-weight:900; color:#111; }
    h1 { font-size:20px; font-weight:800; color:#111; margin:0 0 8px; }
    p { font-size:14px; color:#64748b; margin:0 0 24px; }
    a { display:inline-block; background:#0f9699; color:#fff; font-weight:700; font-size:14px; padding:12px 28px; border-radius:10px; text-decoration:none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <div class="logo-mark">L</div>
      <span class="logo-name">Lumora</span>
    </div>
    <h1>Done!</h1>
    <p>${message}</p>
    <a href="/">Back to Lumora</a>
  </div>
</body>
</html>`;
}
