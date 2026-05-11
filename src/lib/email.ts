import { Resend } from "resend";
import QRCode from "qrcode";
import { getUnsubscribeToken } from "@/lib/unsubscribe";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.EMAIL_FROM ?? "onboarding@resend.dev";

async function send(payload: Parameters<typeof resend.emails.send>[0]) {
  const { data, error } = await resend.emails.send(payload);
  if (error) {
    console.error("[Resend] Failed to send email:", error);
    throw new Error(`Resend error: ${error.message}`);
  }
  return { data, error };
}

/* ─── Shared email shell ────────────────────────────────────────────────── */

function shell({
  preheader,
  headline,
  label,
  accentColor = "#0f9699",
  body,
  footerNote,
  userId,
}: {
  preheader: string;
  headline: string;
  label?: string;
  accentColor?: string;
  body: string;
  footerNote?: string;
  userId?: string;
}) {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${headline}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}&nbsp;&zwnj;</span>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;">
    <tr><td align="center" style="padding:32px 16px;">

      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

        <!-- ══ HEADER ══ -->
        <tr>
          <td bgcolor="#1e293b" style="background:#1e293b;border-radius:16px 16px 0 0;padding:28px 40px 0 40px;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="32" height="32" bgcolor="#0f9699"
                    style="background:#0f9699;border-radius:8px;text-align:center;vertical-align:middle;
                           font-size:16px;font-weight:900;color:#ffffff;line-height:32px;">
                  L
                </td>
                <td style="padding-left:10px;vertical-align:middle;
                           font-size:18px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">
                  Lumora
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Teal hero card inside header -->
        <tr>
          <td bgcolor="#1e293b" style="background:#1e293b;padding:20px 40px 32px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td bgcolor="${accentColor}"
                    style="background:${accentColor};border-radius:12px;padding:22px 26px;">
                  ${label ? `<p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.65);">${label}</p>` : ""}
                  <h1 style="margin:0;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.3px;line-height:1.2;">
                    ${headline}
                  </h1>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ══ BODY ══ -->
        <tr>
          <td bgcolor="#ffffff" style="background:#ffffff;padding:36px 40px;">
            ${body}
          </td>
        </tr>

        <!-- ══ FOOTER ══ -->
        <tr>
          <td bgcolor="#1e293b" style="background:#1e293b;border-radius:0 0 16px 16px;padding:24px 40px;">
            ${footerNote ? `
            <p style="margin:0 0 10px;font-size:12px;color:#94a3b8;text-align:center;">${footerNote}</p>
            ` : ""}
            <p style="margin:0;font-size:12px;color:#cbd5e1;font-weight:600;text-align:center;letter-spacing:0.01em;">
              All payments are non-refundable.
            </p>
            <p style="margin:8px 0 0;font-size:11px;color:#334155;text-align:center;">
              © ${year} Lumora · Secure ticketing platform
            </p>
            ${userId ? `
            <p style="margin:8px 0 0;font-size:10px;color:#334155;text-align:center;">
              <a href="${process.env.NEXTAUTH_URL}/api/unsubscribe?uid=${userId}&token=${getUnsubscribeToken(userId)}" style="color:#475569;text-decoration:underline;">Unsubscribe from marketing emails</a>
            </p>` : ""}
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/* ─── Info card (event details) ─────────────────────────────────────────── */

function infoCard(rows: { label: string; value: string; valueHtml?: string }[]) {
  const rowsHtml = rows
    .map(
      (r, i) => `
    <tr>
      <td style="padding:${i === 0 ? "0" : "14px"} 0 0 0;vertical-align:top;">
        <p style="margin:0 0 3px;font-size:10px;font-weight:700;letter-spacing:1.5px;
                   text-transform:uppercase;color:#0f9699;">
          ${r.label}
        </p>
        <p style="margin:0;font-size:14px;font-weight:600;color:#0f172a;line-height:1.4;">
          ${r.valueHtml ?? r.value}
        </p>
      </td>
    </tr>`
    )
    .join("");

  return `
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:#f0fdfc;border-left:4px solid #0f9699;border-radius:0 10px 10px 0;padding:20px 22px;margin:0;">
    <tr><td>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${rowsHtml}
      </table>
    </td></tr>
  </table>`;
}

/* ─── CTA button ─────────────────────────────────────────────────────────── */

function ctaButton(label: string, href: string, color = "#0f9699") {
  return `
  <table cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td bgcolor="${color}" style="background:${color};border-radius:10px;">
        <a href="${href}"
           style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:700;
                  color:#ffffff;text-decoration:none;letter-spacing:0.3px;">
          ${label} →
        </a>
      </td>
    </tr>
  </table>`;
}

/* ─── Progress bar ───────────────────────────────────────────────────────── */

function progressBar(paidAmount: number, totalAmount: number) {
  const pct = totalAmount > 0 ? Math.min(100, Math.round((paidAmount / totalAmount) * 100)) : 0;
  const fmt = (n: number) => `KES ${n.toLocaleString()}`;
  return `
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:#f0fdfc;border-radius:10px;padding:16px 18px;margin:0;">
    <tr>
      <td>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;">
          <tr>
            <td style="font-size:12px;color:#64748b;">Payment progress</td>
            <td style="text-align:right;font-size:12px;font-weight:700;color:#0f172a;">${pct}%</td>
          </tr>
        </table>
        <!-- Track -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="background:#ccfafb;border-radius:4px;height:8px;">
          <tr>
            <td width="${pct}%" bgcolor="#0f9699"
                style="background:#0f9699;border-radius:4px;height:8px;font-size:0;line-height:0;">&nbsp;</td>
            <td width="${100 - pct}%" style="font-size:0;line-height:0;">&nbsp;</td>
          </tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
          <tr>
            <td style="font-size:12px;color:#0f9699;font-weight:600;">${fmt(paidAmount)} paid</td>
            <td style="text-align:right;font-size:12px;color:#94a3b8;">${fmt(totalAmount)} total</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. Ticket confirmation
   ═══════════════════════════════════════════════════════════════════════════ */

export async function sendTicketConfirmation({
  to,
  name,
  eventTitle,
  categoryName,
  ticketNumbers,
  eventDate,
  venue,
}: {
  to: string;
  name: string;
  eventTitle: string;
  categoryName: string;
  ticketNumbers: string[];
  eventDate: string;
  venue: string;
}) {
  const attachments = await Promise.all(
    ticketNumbers.map(async (num, i) => ({
      filename: `ticket-${i + 1}-qr.png`,
      content: await QRCode.toBuffer(num, { width: 300, margin: 2 }),
      contentId: `ticket-qr-${i}`,
    }))
  );

  const ticketCards = ticketNumbers
    .map(
      (num, i) => `
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="border:1px solid #e0f7f7;border-radius:12px;overflow:hidden;margin-top:16px;">
      <tr>
        <td style="padding:18px 20px 14px;background:#f0fdfc;">
          <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:1.5px;
                     text-transform:uppercase;color:#0f9699;">
            ${ticketNumbers.length > 1 ? `Ticket ${i + 1}` : "Your ticket"}
          </p>
          <p style="margin:0;font-size:20px;font-family:monospace;font-weight:700;
                     color:#0d7a7d;letter-spacing:2px;">${num}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 20px;text-align:center;background:#ffffff;">
          <img src="cid:ticket-qr-${i}" alt="QR Code" width="180" height="180"
               style="border:3px solid #0f9699;border-radius:10px;display:block;margin:0 auto;" />
          <p style="margin:10px 0 0;font-size:11px;color:#94a3b8;">
            Show this QR code at the entrance
          </p>
        </td>
      </tr>
    </table>`
    )
    .join("");

  const body = `
    <p style="margin:0 0 6px;font-size:22px;font-weight:900;color:#0f172a;">
      You're in, ${name}! 🎉
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.5;">
      Your ${ticketNumbers.length > 1 ? `${ticketNumbers.length} tickets are` : "ticket is"} confirmed.
      See you at the event!
    </p>

    ${infoCard([
      { label: "Event",       value: eventTitle },
      { label: "Ticket type", value: categoryName },
      { label: "Date",        value: eventDate },
      { label: "Venue",       value: venue },
    ])}

    ${ticketCards}
  `;

  return send({
    from: FROM_EMAIL,
    to,
    subject: `Your ${ticketNumbers.length > 1 ? `${ticketNumbers.length} tickets` : "ticket"} for ${eventTitle} ✓`,
    attachments,
    html: shell({
      preheader: `You're going to ${eventTitle}! Your ticket is confirmed.`,
      headline: `${eventTitle}`,
      label: "Booking confirmed",
      body,
    }),
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. Cart confirmation (multi-category upfront purchase)
   ═══════════════════════════════════════════════════════════════════════════ */

export async function sendCartConfirmation({
  to,
  name,
  eventTitle,
  eventDate,
  venue,
  categories,
}: {
  to: string;
  name: string;
  eventTitle: string;
  eventDate: string;
  venue: string;
  categories: Array<{ name: string; quantity: number; ticketNumbers: string[] }>;
}) {
  const allTickets = categories.flatMap((c) => c.ticketNumbers.map((num) => ({ num, catName: c.name })));
  const totalTickets = allTickets.length;

  const attachments = await Promise.all(
    allTickets.map(async (t, i) => ({
      filename: `ticket-${i + 1}-qr.png`,
      content: await QRCode.toBuffer(t.num, { width: 300, margin: 2 }),
      contentId: `ticket-qr-${i}`,
    }))
  );

  let attachmentIndex = 0;
  const ticketCards = categories
    .map((cat) =>
      cat.ticketNumbers
        .map((num, ti) => {
          const idx = attachmentIndex++;
          return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="border:1px solid #e0f7f7;border-radius:12px;overflow:hidden;margin-top:16px;">
      <tr>
        <td style="padding:18px 20px 14px;background:#f0fdfc;">
          <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:1.5px;
                     text-transform:uppercase;color:#0f9699;">
            ${cat.name}${cat.ticketNumbers.length > 1 ? ` · Ticket ${ti + 1}` : ""}
          </p>
          <p style="margin:0;font-size:20px;font-family:monospace;font-weight:700;
                     color:#0d7a7d;letter-spacing:2px;">${num}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 20px;text-align:center;background:#ffffff;">
          <img src="cid:ticket-qr-${idx}" alt="QR Code" width="180" height="180"
               style="border:3px solid #0f9699;border-radius:10px;display:block;margin:0 auto;" />
          <p style="margin:10px 0 0;font-size:11px;color:#94a3b8;">
            Show this QR code at the entrance
          </p>
        </td>
      </tr>
    </table>`;
        })
        .join("")
    )
    .join("");

  const body = `
    <p style="margin:0 0 6px;font-size:22px;font-weight:900;color:#0f172a;">
      You're in, ${name}! 🎉
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.5;">
      Your ${totalTickets} ticket${totalTickets > 1 ? "s are" : " is"} confirmed. See you at the event!
    </p>

    ${infoCard([
      { label: "Event", value: eventTitle },
      { label: "Date",  value: eventDate },
      { label: "Venue", value: venue },
    ])}

    ${ticketCards}
  `;

  return send({
    from: FROM_EMAIL,
    to,
    subject: `Your ${totalTickets} ticket${totalTickets > 1 ? "s" : ""} for ${eventTitle} ✓`,
    attachments,
    html: shell({
      preheader: `You're going to ${eventTitle}! Your tickets are confirmed.`,
      headline: eventTitle,
      label: "Booking confirmed",
      body,
    }),
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. Installment receipt
   ═══════════════════════════════════════════════════════════════════════════ */

export async function sendInstallmentReceipt({
  to,
  name,
  eventTitle,
  categoryName,
  eventDate,
  venue,
  amountPaid,
  totalPaid,
  totalAmount,
  remainingPayments,
  isDeposit = false,
}: {
  to: string;
  name: string;
  eventTitle: string;
  categoryName: string;
  eventDate: string;
  venue: string;
  amountPaid: number;
  totalPaid: number;
  totalAmount: number;
  remainingPayments: { installmentNumber: number; amount: number; dueDate: string }[];
  isDeposit?: boolean;
}) {
  const fmt = (n: number) => `KES ${n.toLocaleString()}`;

  const scheduleRows = remainingPayments
    .map(
      (p) => `
    <tr>
      <td style="padding:10px 0;border-top:1px solid #e0f7f7;font-size:13px;color:#475569;">
        Installment ${p.installmentNumber}
      </td>
      <td style="padding:10px 0;border-top:1px solid #e0f7f7;font-size:13px;
                  color:#475569;text-align:center;">${p.dueDate}</td>
      <td style="padding:10px 0;border-top:1px solid #e0f7f7;font-size:13px;
                  font-weight:700;color:#0f172a;text-align:right;">${fmt(p.amount)}</td>
    </tr>`
    )
    .join("");

  const remainingSection = remainingPayments.length > 0 ? `
    <p style="margin:28px 0 10px;font-size:12px;font-weight:700;letter-spacing:1px;
               text-transform:uppercase;color:#64748b;">
      Remaining installments
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <th style="text-align:left;font-size:10px;font-weight:700;letter-spacing:1px;
                    text-transform:uppercase;color:#94a3b8;padding-bottom:8px;">Payment</th>
        <th style="text-align:center;font-size:10px;font-weight:700;letter-spacing:1px;
                    text-transform:uppercase;color:#94a3b8;padding-bottom:8px;">Due date</th>
        <th style="text-align:right;font-size:10px;font-weight:700;letter-spacing:1px;
                    text-transform:uppercase;color:#94a3b8;padding-bottom:8px;">Amount</th>
      </tr>
      ${scheduleRows}
    </table>
  ` : `
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#f0fdf4;border-radius:10px;padding:16px 18px;margin-top:20px;">
      <tr>
        <td style="font-size:14px;font-weight:700;color:#166534;">
          ✓ All payments complete — your ticket QR code will arrive shortly!
        </td>
      </tr>
    </table>
  `;

  const headline = isDeposit ? "Deposit confirmed" : "Payment received";
  const intro = isDeposit
    ? `Your deposit of <strong style="color:#0f172a;">${fmt(amountPaid)}</strong> for <strong style="color:#0f172a;">${eventTitle}</strong> is confirmed. Your remaining installments are listed below.`
    : `We've received <strong style="color:#0f172a;">${fmt(amountPaid)}</strong> for <strong style="color:#0f172a;">${eventTitle}</strong>.`;

  const body = `
    <p style="margin:0 0 6px;font-size:22px;font-weight:900;color:#0f172a;">
      ${headline}, ${name}!
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.5;">
      ${intro}
    </p>

    ${infoCard([
      { label: "Event",       value: eventTitle },
      { label: "Ticket type", value: categoryName },
      { label: "Date",        value: eventDate },
      { label: "Venue",       value: venue },
    ])}

    <div style="margin-top:20px;">
      ${progressBar(totalPaid, totalAmount)}
    </div>

    ${remainingSection}
  `;

  return send({
    from: FROM_EMAIL,
    to,
    subject: isDeposit ? `Deposit confirmed — ${eventTitle}` : `Payment received — ${eventTitle}`,
    html: shell({
      preheader: isDeposit ? `Your deposit of ${fmt(amountPaid)} for ${eventTitle} is confirmed.` : `${fmt(amountPaid)} received for ${eventTitle}.`,
      headline,
      label: isDeposit ? "Deposit confirmed" : "Installment update",
      body,
    }),
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. Installment reminder
   ═══════════════════════════════════════════════════════════════════════════ */

export async function sendInstallmentReminder({
  to,
  name,
  eventTitle,
  amount,
  dueDate,
  daysUntilDue,
  paymentUrl,
}: {
  to: string;
  name: string;
  eventTitle: string;
  amount: string;
  dueDate: string;
  daysUntilDue: number;
  paymentUrl: string;
}) {
  const urgencyLine =
    daysUntilDue === 0
      ? "Your installment is <strong>due today</strong>. Pay now to keep your ticket."
      : daysUntilDue === 1
      ? "Your installment is <strong>due tomorrow</strong>. Pay now to avoid any issues."
      : `Your installment is due in <strong>${daysUntilDue} days</strong>. Pay on time to keep your ticket.`;

  const subject =
    daysUntilDue === 0
      ? `Due today: ${amount} for ${eventTitle}`
      : daysUntilDue === 1
      ? `Due tomorrow: ${amount} for ${eventTitle}`
      : `Payment due in ${daysUntilDue} days: ${eventTitle}`;

  const body = `
    <p style="margin:0 0 6px;font-size:22px;font-weight:900;color:#0f172a;">
      Hi ${name}, payment reminder
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.5;">
      ${urgencyLine}
    </p>

    ${infoCard([
      { label: "Event",        value: eventTitle },
      { label: "Amount due",   value: amount },
      { label: "Due date",     value: dueDate },
    ])}

    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 10px 10px 0;
                  padding:14px 18px;margin:24px 0;">
      <tr>
        <td style="font-size:13px;color:#92400e;line-height:1.5;">
          <strong>⚠ Important:</strong> Missed payments may result in ticket revocation
          after the grace period expires.
        </td>
      </tr>
    </table>

    ${ctaButton("Pay Now", paymentUrl)}
  `;

  return send({
    from: FROM_EMAIL,
    to,
    subject,
    html: shell({
      preheader: `Your installment of ${amount} for ${eventTitle} is due on ${dueDate}.`,
      headline: "Payment due soon",
      label: "Action required",
      accentColor: "#d97706",
      body,
      footerNote: "You're receiving this because you have an active installment plan.",
    }),
  });
}

export async function sendDefaultWarning({
  to,
  name,
  eventTitle,
  amount,
  daysUntilRevocation,
  paymentUrl,
}: {
  to: string;
  name: string;
  eventTitle: string;
  amount: string;
  daysUntilRevocation: number;
  paymentUrl: string;
}) {
  const urgencyLine =
    daysUntilRevocation === 0
      ? "Your ticket will be <strong>revoked today</strong> unless you pay now."
      : daysUntilRevocation === 1
      ? "Your ticket will be revoked <strong>tomorrow</strong> unless you pay immediately."
      : `Your ticket will be revoked in <strong>${daysUntilRevocation} days</strong> unless payment is received.`;

  const subject =
    daysUntilRevocation === 0
      ? `URGENT: Your ticket for ${eventTitle} will be revoked today`
      : daysUntilRevocation === 1
      ? `URGENT: Your ticket for ${eventTitle} will be revoked tomorrow`
      : `Action required: ${daysUntilRevocation} days until your ticket is revoked`;

  const body = `
    <p style="margin:0 0 6px;font-size:22px;font-weight:900;color:#0f172a;">
      Hi ${name}, your ticket is at risk
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.5;">
      ${urgencyLine}
    </p>

    ${infoCard([
      { label: "Event",            value: eventTitle },
      { label: "Overdue amount",   value: amount },
      { label: "Days to revocation", value: daysUntilRevocation === 0 ? "Today" : `${daysUntilRevocation} day${daysUntilRevocation !== 1 ? "s" : ""}` },
    ])}

    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:0 10px 10px 0;
                  padding:14px 18px;margin:24px 0;">
      <tr>
        <td style="font-size:13px;color:#991b1b;line-height:1.5;">
          <strong>⛔ Warning:</strong> If payment is not received in time, your ticket will be
          permanently revoked and you will lose access to the event.
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:0 10px 10px 0;
                  padding:14px 18px;margin:0 0 24px;">
      <tr>
        <td style="font-size:13px;color:#1e40af;line-height:1.5;">
          <strong>💡 Can't pay right now?</strong> You can transfer your ticket to someone else before
          it is revoked. Log in to your Lumora account and use the <strong>Transfer ticket</strong>
          option on your order to pass ownership — and the remaining payment schedule — to another person.
        </td>
      </tr>
    </table>

    ${ctaButton("Pay Now to Keep Your Ticket", paymentUrl)}
  `;

  return send({
    from: FROM_EMAIL,
    to,
    subject,
    html: shell({
      preheader: `Pay ${amount} now — your ticket for ${eventTitle} will be revoked in ${daysUntilRevocation} day${daysUntilRevocation !== 1 ? "s" : ""}.`,
      headline: "Ticket revocation warning",
      label: "Urgent action required",
      accentColor: "#dc2626",
      body,
      footerNote: "You're receiving this because a payment on your installment plan is overdue.",
    }),
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. Ticket revocation notice
   ═══════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════
   5. Event invite (private events)
   ═══════════════════════════════════════════════════════════════════════════ */

export async function sendEventInvite(
  to: string,
  name: string | null,
  event: { title: string; date: string; venue: string; slug: string }
) {
  const greeting = name ? `Hi ${name},` : "Hi there,";
  const eventUrl = `${process.env.NEXTAUTH_URL}/events/${event.slug}`;

  const body = `
    <p style="margin:0 0 6px;font-size:22px;font-weight:900;color:#0f172a;">
      You're invited!
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.5;">
      ${greeting} You've been personally invited to attend a private experience on Lumora.
    </p>

    ${infoCard([
      { label: "Event", value: event.title },
      { label: "Date",  value: event.date },
      { label: "Venue", value: event.venue },
    ])}

    <p style="margin:24px 0 16px;font-size:13px;color:#64748b;line-height:1.5;">
      This is a private event — use the button below to view details and register.
    </p>

    ${ctaButton("View &amp; Register", eventUrl)}
  `;

  return send({
    from: FROM_EMAIL,
    to,
    subject: `You're invited to ${event.title}`,
    html: shell({
      preheader: `You've been invited to ${event.title} — a private experience on Lumora.`,
      headline: event.title,
      label: "Private invitation",
      body,
    }),
  });
}

export async function sendTicketRevocationNotice({
  to,
  name,
  eventTitle,
  reason,
}: {
  to: string;
  name: string;
  eventTitle: string;
  reason: string;
}) {
  const body = `
    <p style="margin:0 0 6px;font-size:22px;font-weight:900;color:#0f172a;">
      Hi ${name},
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.5;">
      Unfortunately, your ticket for <strong style="color:#0f172a;">${eventTitle}</strong> has been revoked.
    </p>

    ${infoCard([
      { label: "Event",  value: eventTitle },
      { label: "Reason", value: reason },
    ])}

    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#fff1f2;border-left:4px solid #ef4444;border-radius:0 10px 10px 0;
                  padding:14px 18px;margin:24px 0;">
      <tr>
        <td style="font-size:13px;color:#991b1b;line-height:1.5;">
          All payments made are <strong>non-refundable</strong>. If you believe this was
          an error, please contact the event organiser directly.
        </td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#f8fafc;border-left:4px solid #94a3b8;border-radius:0 10px 10px 0;
                  padding:14px 18px;margin:0 0 24px;">
      <tr>
        <td style="font-size:13px;color:#475569;line-height:1.5;">
          <strong>💡 Tip for next time:</strong> If you are unable to keep up with payments, you can
          transfer your ticket to someone else <em>before</em> it is revoked. Use the
          <strong>Transfer ticket</strong> option in your Lumora account to pass ownership and the
          remaining payment schedule to another person — transferred tickets cannot be reinstated
          after revocation.
        </td>
      </tr>
    </table>
  `;

  return send({
    from: FROM_EMAIL,
    to,
    subject: `Your ticket for ${eventTitle} has been revoked`,
    html: shell({
      preheader: `Your ticket for ${eventTitle} has been revoked.`,
      headline: "Ticket revoked",
      label: "Notice",
      accentColor: "#dc2626",
      body,
      footerNote: "This is an automated notice from Lumora.",
    }),
  });
}

export async function sendTicketReinstatementNotice({
  to,
  name,
  eventTitle,
}: {
  to: string;
  name: string;
  eventTitle: string;
}) {
  const body = `
    <p style="margin:0 0 6px;font-size:22px;font-weight:900;color:#0f172a;">
      Good news, ${name}!
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.5;">
      Your ticket for <strong style="color:#0f172a;">${eventTitle}</strong> has been reinstated.
      Your access is fully restored and your ticket is valid again.
    </p>

    ${infoCard([
      { label: "Event",  value: eventTitle },
      { label: "Status", value: "Reinstated — ticket is valid" },
    ])}

    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#f0fdf4;border-left:4px solid #22c55e;border-radius:0 10px 10px 0;
                  padding:14px 18px;margin:24px 0;">
      <tr>
        <td style="font-size:13px;color:#166534;line-height:1.5;">
          If you had outstanding installments, they have been restored to overdue status.
          Please log in and complete any remaining payments to avoid future revocation.
        </td>
      </tr>
    </table>
  `;

  return send({
    from: FROM_EMAIL,
    to,
    subject: `Your ticket for ${eventTitle} has been reinstated`,
    html: shell({
      preheader: `Great news — your ticket for ${eventTitle} is valid again.`,
      headline: "Ticket reinstated",
      label: "Good news",
      accentColor: "#16a34a",
      body,
      footerNote: "This is an automated notice from Lumora.",
    }),
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   8. Group trip booking confirmation (no QR ticket)
   ═══════════════════════════════════════════════════════════════════════════ */

export async function sendBookingConfirmation({
  to,
  name,
  eventTitle,
  categoryName,
  quantity,
  totalAmount,
  paidAmount,
  eventDate,
  venue,
}: {
  to: string;
  name: string;
  eventTitle: string;
  categoryName: string;
  quantity: number;
  totalAmount: number;
  paidAmount: number;
  eventDate: string;
  venue: string;
}) {
  const isFullyPaid = paidAmount >= totalAmount - 0.01;

  const body = isFullyPaid ? `
    <p style="margin:0 0 6px;font-size:22px;font-weight:900;color:#0f172a;">
      You're in, ${name}!
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.5;">
      All payments are complete. Your ${quantity > 1 ? `${quantity} spots are` : "spot is"} fully confirmed for <strong style="color:#0f172a;">${eventTitle}</strong>.
    </p>

    ${infoCard([
      { label: "Experience",   value: eventTitle },
      { label: "Tier",         value: categoryName },
      { label: "Spots booked", value: String(quantity) },
      { label: "Date",         value: eventDate },
      { label: "Location",     value: venue },
    ])}
  ` : `
    <p style="margin:0 0 6px;font-size:22px;font-weight:900;color:#0f172a;">
      You're booked, ${name}!
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.5;">
      Your ${quantity > 1 ? `${quantity} spots are` : "spot is"} confirmed for <strong style="color:#0f172a;">${eventTitle}</strong>. Your first payment has been received — remaining installments are listed below.
    </p>

    ${infoCard([
      { label: "Experience",   value: eventTitle },
      { label: "Tier",         value: categoryName },
      { label: "Spots booked", value: String(quantity) },
      { label: "Date",         value: eventDate },
      { label: "Location",     value: venue },
    ])}

    <div style="margin-top:20px;">${progressBar(paidAmount, totalAmount)}</div>
  `;

  return send({
    from: FROM_EMAIL,
    to,
    subject: isFullyPaid ? `You're in: ${eventTitle}` : `Booking confirmed: ${eventTitle}`,
    html: shell({
      preheader: isFullyPaid ? `All payments complete for ${eventTitle}. See you there!` : `You're booked for ${eventTitle}!`,
      headline: isFullyPaid ? "You're in!" : eventTitle,
      label: isFullyPaid ? "Payment complete" : "Booking confirmed",
      body,
    }),
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   9. Ticket transfer invite
   ═══════════════════════════════════════════════════════════════════════════ */

export async function sendTransferInvite({
  to,
  name,
  fromName,
  eventTitle,
  categoryName,
  eventDate,
  venue,
  acceptUrl,
  expiresAt,
  isInstallment,
  hasDefaultedPayments = false,
  defaultedAmount,
}: {
  to: string;
  name: string;
  fromName: string;
  eventTitle: string;
  categoryName: string;
  eventDate: string;
  venue: string;
  acceptUrl: string;
  expiresAt: string;
  isInstallment: boolean;
  hasDefaultedPayments?: boolean;
  defaultedAmount?: string;
}) {
  const transferType = isInstallment ? "payment schedule (installment plan)" : "fully paid ticket";

  const defaultedWarning = hasDefaultedPayments && defaultedAmount ? `
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#fff7ed;border-left:4px solid #f97316;border-radius:0 10px 10px 0;
                  padding:14px 18px;margin:24px 0;">
      <tr>
        <td style="font-size:13px;color:#9a3412;line-height:1.5;">
          <strong>⚠️ Immediate payment required:</strong> This payment schedule has
          <strong>${defaultedAmount}</strong> in overdue instalments. When you accept this transfer
          you will be taken to pay this amount immediately before taking ownership. Subsequent
          instalments will then continue on the original schedule.
        </td>
      </tr>
    </table>
  ` : "";

  const body = `
    <p style="margin:0 0 6px;font-size:22px;font-weight:900;color:#0f172a;">
      Hi ${name},
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.5;">
      <strong style="color:#0f172a;">${fromName}</strong> is transferring their <strong style="color:#0f172a;">${transferType}</strong> for <strong style="color:#0f172a;">${eventTitle}</strong> to you. Review the details below and accept to take ownership.
    </p>

    ${infoCard([
      { label: "Event",       value: eventTitle },
      { label: "Ticket type", value: categoryName },
      { label: "Date",        value: eventDate },
      { label: "Venue",       value: venue },
    ])}

    ${defaultedWarning}

    <div style="margin-top:28px;">
      ${ctaButton(hasDefaultedPayments ? "Review &amp; Accept Transfer" : "Review &amp; Accept Transfer", acceptUrl)}
    </div>

    <p style="margin:20px 0 0;font-size:13px;color:#64748b;line-height:1.5;">
      This offer expires on <strong style="color:#0f172a;">${expiresAt}</strong>.
    </p>

    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;line-height:1.5;">
      If you don't recognise this invitation, you can safely ignore this email.
    </p>
  `;

  return send({
    from: FROM_EMAIL,
    to,
    subject: `${fromName} wants to transfer their ticket — ${eventTitle}`,
    html: shell({
      preheader: `You've been invited to take over a ticket for ${eventTitle}.`,
      headline: "Ticket transfer invitation",
      label: "Transfer offer",
      body,
    }),
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   10. Ticket transfer notification (sender update)
   ═══════════════════════════════════════════════════════════════════════════ */

export async function sendTransferNotification({
  to,
  name,
  eventTitle,
  toName,
  wasAccepted,
}: {
  to: string;
  name: string;
  eventTitle: string;
  toName: string;
  wasAccepted: boolean;
}) {
  const headline = wasAccepted ? "Transfer accepted" : "Transfer declined";
  const bodyText = wasAccepted
    ? `<strong style="color:#0f172a;">${toName}</strong> has accepted your transfer for <strong style="color:#0f172a;">${eventTitle}</strong>. The ticket and any remaining payments are now theirs.`
    : `<strong style="color:#0f172a;">${toName}</strong> has declined your transfer for <strong style="color:#0f172a;">${eventTitle}</strong>. Your ticket remains with you.`;

  const body = `
    <p style="margin:0 0 6px;font-size:22px;font-weight:900;color:#0f172a;">
      Hi ${name},
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.5;">
      ${bodyText}
    </p>
  `;

  const subject = `Transfer ${wasAccepted ? "accepted" : "declined"} — ${eventTitle}`;

  return send({
    from: FROM_EMAIL,
    to,
    subject,
    html: shell({
      preheader: subject,
      headline,
      label: "Transfer update",
      body,
    }),
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   PASSWORD RESET
   ═══════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════
   SELLER ALERTS
   ═══════════════════════════════════════════════════════════════════════════ */

export async function sendSellerDefaultAlert({
  to,
  sellerName,
  buyerName,
  eventTitle,
  categoryName,
  overdueAmount,
  defaultersUrl,
}: {
  to: string;
  sellerName: string;
  buyerName: string;
  eventTitle: string;
  categoryName: string;
  overdueAmount: string;
  defaultersUrl: string;
}) {
  const body = `
    <p style="margin:0 0 6px;font-size:22px;font-weight:900;color:#0f172a;">
      Hi ${sellerName},
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.5;">
      A buyer has missed an installment payment and is now in default. Review the details below and decide whether to extend the grace period or proceed with revocation.
    </p>

    ${infoCard([
      { label: "Buyer",        value: buyerName },
      { label: "Event",        value: eventTitle },
      { label: "Ticket type",  value: categoryName },
      { label: "Overdue",      value: overdueAmount },
    ])}

    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 10px 10px 0;
                  padding:14px 18px;margin:24px 0;">
      <tr>
        <td style="font-size:13px;color:#92400e;line-height:1.5;">
          <strong>What happens next:</strong> If the buyer does not pay within the grace period,
          their ticket will be automatically revoked. You can extend the grace period or revoke
          manually from your dashboard.
        </td>
      </tr>
    </table>

    ${ctaButton("View Defaulters", defaultersUrl, "#d97706")}
  `;

  return send({
    from: FROM_EMAIL,
    to,
    subject: `Missed payment: ${buyerName} — ${eventTitle}`,
    html: shell({
      preheader: `${buyerName} has missed an installment for ${eventTitle}.`,
      headline: "Buyer in default",
      label: "Payment alert",
      accentColor: "#d97706",
      body,
      footerNote: "You're receiving this as the event organiser.",
    }),
  });
}

export async function sendSellerPreRevocationAlert({
  to,
  sellerName,
  buyerName,
  eventTitle,
  categoryName,
  overdueAmount,
  defaultersUrl,
}: {
  to: string;
  sellerName: string;
  buyerName: string;
  eventTitle: string;
  categoryName: string;
  overdueAmount: string;
  defaultersUrl: string;
}) {
  const body = `
    <p style="margin:0 0 6px;font-size:22px;font-weight:900;color:#0f172a;">
      Hi ${sellerName},
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.5;">
      A buyer's ticket is scheduled for revocation <strong style="color:#0f172a;">tomorrow</strong> due to a missed installment payment. If you'd like to extend their grace period, do so now from your dashboard.
    </p>

    ${infoCard([
      { label: "Buyer",        value: buyerName },
      { label: "Event",        value: eventTitle },
      { label: "Ticket type",  value: categoryName },
      { label: "Overdue",      value: overdueAmount },
    ])}

    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:0 10px 10px 0;
                  padding:14px 18px;margin:24px 0;">
      <tr>
        <td style="font-size:13px;color:#991b1b;line-height:1.5;">
          <strong>⚠ Revocation tomorrow:</strong> The ticket will be automatically revoked in
          approximately 24 hours if no action is taken.
        </td>
      </tr>
    </table>

    ${ctaButton("Manage Grace Period", defaultersUrl, "#dc2626")}
  `;

  return send({
    from: FROM_EMAIL,
    to,
    subject: `Revocation tomorrow: ${buyerName} — ${eventTitle}`,
    html: shell({
      preheader: `${buyerName}'s ticket for ${eventTitle} will be revoked tomorrow.`,
      headline: "Revocation in 24 hours",
      label: "Urgent alert",
      accentColor: "#dc2626",
      body,
      footerNote: "You're receiving this as the event organiser.",
    }),
  });
}

export async function sendPasswordResetEmail({
  to,
  name,
  resetUrl,
}: {
  to: string;
  name: string;
  resetUrl: string;
}) {
  const subject = "Reset your Lumora password";

  const body = `
    <p style="margin:0 0 6px;font-size:22px;font-weight:900;color:#0f172a;">
      Hi ${name},
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.5;">
      We received a request to reset the password for your Lumora account. Click the button below to choose a new password. This link expires in <strong style="color:#0f172a;">1 hour</strong>.
    </p>
    <div style="text-align:center;margin:0 0 24px;">
      <a href="${resetUrl}"
         style="display:inline-block;background:#0d9488;color:#fff;font-size:14px;font-weight:700;padding:14px 32px;border-radius:12px;text-decoration:none;letter-spacing:0.01em;">
        Reset password
      </a>
    </div>
    <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
      If you didn&apos;t request this, you can safely ignore this email. Your password won&apos;t change.
    </p>
  `;

  return send({
    from: FROM_EMAIL,
    to,
    subject,
    html: shell({
      preheader: "Reset your Lumora password — link valid for 1 hour",
      headline: "Password reset",
      label: "Security",
      body,
    }),
  });
}
