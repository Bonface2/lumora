import { Resend } from "resend";
import QRCode from "qrcode";

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
}: {
  preheader: string;
  headline: string;
  label?: string;
  accentColor?: string;
  body: string;
  footerNote?: string;
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
            <p style="margin:0;font-size:11px;color:#475569;text-align:center;">
              Tickets are non-transferable except through the Lumora resale market.
              All payments are non-refundable.
            </p>
            <p style="margin:8px 0 0;font-size:11px;color:#334155;text-align:center;">
              © ${year} Lumora · Secure ticketing platform
            </p>
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
}) {
  const fmt = (n: number) => `KES ${n.toLocaleString()}`;

  const scheduleRows = remainingPayments
    .map(
      (p, i) => `
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

  const body = `
    <p style="margin:0 0 6px;font-size:22px;font-weight:900;color:#0f172a;">
      Payment received, ${name}!
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.5;">
      We've received <strong style="color:#0f172a;">${fmt(amountPaid)}</strong> for
      <strong style="color:#0f172a;">${eventTitle}</strong>.
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
    subject: `Payment received — ${eventTitle}`,
    html: shell({
      preheader: `${fmt(amountPaid)} received for ${eventTitle}.`,
      headline: "Payment received",
      label: "Installment update",
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
  paymentUrl,
}: {
  to: string;
  name: string;
  eventTitle: string;
  amount: string;
  dueDate: string;
  paymentUrl: string;
}) {
  const body = `
    <p style="margin:0 0 6px;font-size:22px;font-weight:900;color:#0f172a;">
      Hi ${name}, payment due soon
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;line-height:1.5;">
      A friendly reminder that your installment is coming up. Pay on time to keep your ticket.
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
    subject: `Payment reminder: ${eventTitle} — due ${dueDate}`,
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

/* ═══════════════════════════════════════════════════════════════════════════
   4. Ticket revocation notice
   ═══════════════════════════════════════════════════════════════════════════ */

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
