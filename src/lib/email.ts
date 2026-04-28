import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.EMAIL_FROM ?? "Lumora <noreply@lumora.app>";

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
  return resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Payment reminder: ${eventTitle} — due ${dueDate}`,
    html: `
      <h2>Hi ${name},</h2>
      <p>This is a reminder that your installment payment of <strong>${amount}</strong> for
      <strong>${eventTitle}</strong> is due on <strong>${dueDate}</strong>.</p>
      <p>Please complete your payment to keep your ticket active.</p>
      <p>
        <a href="${paymentUrl}" style="background:#7c3aed;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
          Pay Now
        </a>
      </p>
      <p style="color:#888;font-size:12px;">
        If you do not pay by the due date, your ticket may be revoked and all payments made
        are non-refundable. You may choose to list your ticket on the Lumora resale market.
      </p>
    `,
  });
}

export async function sendTicketConfirmation({
  to,
  name,
  eventTitle,
  ticketNumber,
  eventDate,
  venue,
}: {
  to: string;
  name: string;
  eventTitle: string;
  ticketNumber: string;
  eventDate: string;
  venue: string;
}) {
  return resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Your ticket for ${eventTitle}`,
    html: `
      <h2>Hi ${name}, you're going to ${eventTitle}!</h2>
      <p><strong>Ticket #:</strong> ${ticketNumber}</p>
      <p><strong>Date:</strong> ${eventDate}</p>
      <p><strong>Venue:</strong> ${venue}</p>
      <p>Present this ticket number or your QR code at the venue entrance.</p>
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
  return resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Ticket revoked: ${eventTitle}`,
    html: `
      <h2>Hi ${name},</h2>
      <p>Your ticket for <strong>${eventTitle}</strong> has been revoked.</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p style="color:#888;font-size:12px;">
        All payments made are non-refundable. If you have questions, please contact the event organiser.
      </p>
    `,
  });
}
