import { Resend } from "resend";
import QRCode from "qrcode";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.EMAIL_FROM ?? "onboarding@resend.dev";

async function send(payload: Parameters<typeof resend.emails.send>[0]) {
  const { data, error } = await resend.emails.send(payload);
  if (error) {
    console.error("[Resend] Failed to send email:", error);
  }
  return { data, error };
}

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
  // Generate one QR code per ticket
  const attachments = await Promise.all(
    ticketNumbers.map(async (num, i) => ({
      filename: `ticket-${i + 1}-qr.png`,
      content: await QRCode.toBuffer(num, { width: 300, margin: 2 }),
      contentId: `ticket-qr-${i}`,
    }))
  );

  const ticketsHtml = ticketNumbers
    .map(
      (num, i) => `
      <tr>
        <td style="padding:16px 20px;${i > 0 ? "border-top:1px solid #e9e4ff;" : ""}">
          <p style="margin:0 0 4px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px;">
            Ticket ${ticketNumbers.length > 1 ? i + 1 : ""}
          </p>
          <p style="margin:0 0 12px;font-size:20px;font-family:monospace;font-weight:700;color:#7c3aed;letter-spacing:2px;">${num}</p>
          <div style="text-align:center;">
            <img src="cid:ticket-qr-${i}" alt="QR Code" width="180" height="180"
              style="border:3px solid #7c3aed;border-radius:8px;" />
          </div>
        </td>
      </tr>`
    )
    .join("");

  return send({
    from: FROM_EMAIL,
    to,
    subject: `Your ${ticketNumbers.length > 1 ? `${ticketNumbers.length} tickets` : "ticket"} for ${eventTitle}`,
    attachments,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111;">
        <h1 style="font-size:22px;margin-bottom:4px;">You're going to ${eventTitle}!</h1>
        <p style="color:#555;margin-top:0;">
          Hi ${name}, your ${ticketNumbers.length > 1 ? `${ticketNumbers.length} tickets are` : "ticket is"} confirmed.
        </p>

        <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#f9f7ff;border-radius:10px;">
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0 0 4px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px;">Event</p>
              <p style="margin:0;font-weight:600;">${eventTitle}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 20px 16px;">
              <p style="margin:0 0 4px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px;">Ticket type</p>
              <p style="margin:0;font-weight:600;">${categoryName}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 20px 16px;">
              <p style="margin:0 0 4px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px;">Date &amp; Venue</p>
              <p style="margin:0;">${eventDate}</p>
              <p style="margin:2px 0 0;color:#555;">${venue}</p>
            </td>
          </tr>
          ${ticketsHtml}
        </table>

        <p style="font-size:12px;color:#999;border-top:1px solid #eee;padding-top:16px;margin-top:8px;">
          Tickets are non-transferable except through the Lumora resale market.
          All payments are non-refundable.
        </p>
      </body>
      </html>
    `,
  });
}

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
      (p) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #e9e4ff;font-size:13px;color:#555;">
          Installment ${p.installmentNumber}
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #e9e4ff;font-size:13px;color:#555;text-align:center;">
          ${p.dueDate}
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #e9e4ff;font-size:13px;font-weight:600;color:#111;text-align:right;">
          ${fmt(p.amount)}
        </td>
      </tr>`
    )
    .join("");

  return send({
    from: FROM_EMAIL,
    to,
    subject: `Payment received — ${eventTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111;">
        <h1 style="font-size:22px;margin-bottom:4px;">Payment received</h1>
        <p style="color:#555;margin-top:0;">
          Hi ${name}, we've received your payment of <strong>${fmt(amountPaid)}</strong> for
          <strong>${eventTitle}</strong>.
        </p>

        <table style="width:100%;border-collapse:collapse;margin:20px 0;background:#f9f7ff;border-radius:10px;">
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0 0 4px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px;">Event</p>
              <p style="margin:0;font-weight:600;">${eventTitle}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 20px 16px;">
              <p style="margin:0 0 4px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px;">Ticket type</p>
              <p style="margin:0;font-weight:600;">${categoryName}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 20px 16px;">
              <p style="margin:0 0 4px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px;">Date &amp; Venue</p>
              <p style="margin:0;">${eventDate}</p>
              <p style="margin:2px 0 0;color:#555;">${venue}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 20px 16px;border-top:1px solid #e9e4ff;">
              <p style="margin:0 0 4px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px;">Payment progress</p>
              <p style="margin:0;font-size:15px;">
                <span style="font-weight:700;color:#7c3aed;">${fmt(totalPaid)}</span>
                <span style="color:#888;"> paid of ${fmt(totalAmount)}</span>
              </p>
              <div style="margin-top:8px;height:6px;background:#e9e4ff;border-radius:3px;overflow:hidden;">
                <div style="height:100%;width:${Math.min(100, Math.round((totalPaid / totalAmount) * 100))}%;background:#7c3aed;border-radius:3px;"></div>
              </div>
            </td>
          </tr>
        </table>

        ${remainingPayments.length > 0 ? `
        <p style="font-size:13px;font-weight:600;color:#111;margin-bottom:8px;">Remaining installments</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <th style="text-align:left;font-size:11px;color:#888;text-transform:uppercase;padding-bottom:6px;">Payment</th>
            <th style="text-align:center;font-size:11px;color:#888;text-transform:uppercase;padding-bottom:6px;">Due date</th>
            <th style="text-align:right;font-size:11px;color:#888;text-transform:uppercase;padding-bottom:6px;">Amount</th>
          </tr>
          ${scheduleRows}
        </table>
        ` : ""}

        <p style="margin-top:20px;padding:12px 16px;background:#fef9c3;border-radius:8px;font-size:13px;color:#854d0e;">
          Your ticket and QR code will be sent to this email once all payments are complete.
        </p>

        <p style="font-size:12px;color:#999;border-top:1px solid #eee;padding-top:16px;margin-top:8px;">
          All payments are non-refundable. Missed payments may result in ticket revocation.
        </p>
      </body>
      </html>
    `,
  });
}

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
  return send({
    from: FROM_EMAIL,
    to,
    subject: `Payment reminder: ${eventTitle} — due ${dueDate}`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111;">
        <h2>Hi ${name},</h2>
        <p>Your installment of <strong>${amount}</strong> for <strong>${eventTitle}</strong>
        is due on <strong>${dueDate}</strong>.</p>
        <p>
          <a href="${paymentUrl}"
            style="background:#7c3aed;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
            Pay Now
          </a>
        </p>
        <p style="color:#888;font-size:12px;">
          Missed payments may result in ticket revocation. All payments are non-refundable.
        </p>
      </body>
      </html>
    `,
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
  return send({
    from: FROM_EMAIL,
    to,
    subject: `Ticket revoked: ${eventTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111;">
        <h2>Hi ${name},</h2>
        <p>Your ticket for <strong>${eventTitle}</strong> has been revoked.</p>
        <p><strong>Reason:</strong> ${reason}</p>
        <p style="color:#888;font-size:12px;">
          All payments made are non-refundable. If you have questions, please contact the event organiser.
        </p>
      </body>
      </html>
    `,
  });
}
