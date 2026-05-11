import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTransferByToken } from "@/app/actions/transfer";
import { format } from "date-fns";
import Link from "next/link";
import { TransferActions } from "./TransferActions";

export default async function TransferPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const transfer = await getTransferByToken(token);

  if (!transfer) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
        <p className="text-lg font-semibold text-gray-900">Transfer not found.</p>
        <Link href="/" className="mt-4 text-sm text-primary-600 hover:underline">Back to home</Link>
      </div>
    );
  }

  // Show a clean status page for terminal states
  if (transfer.status !== "PENDING") {
    const messages: Record<string, string> = {
      ACCEPTED: "This transfer has already been accepted.",
      DECLINED: "This transfer was declined.",
      CANCELLED: "This transfer was cancelled by the sender.",
      EXPIRED:   "This transfer has expired.",
    };
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
        <p className="text-lg font-semibold text-gray-900">{messages[transfer.status] ?? "Transfer unavailable."}</p>
        <Link href="/buyer" className="mt-4 text-sm text-primary-600 hover:underline">My tickets</Link>
      </div>
    );
  }

  if (new Date() > transfer.expiresAt) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
        <p className="text-lg font-semibold text-gray-900">This transfer has expired.</p>
        <Link href="/" className="mt-4 text-sm text-primary-600 hover:underline">Back to home</Link>
      </div>
    );
  }

  const session = await auth();

  // Not logged in — send to login then back here
  if (!session?.user) {
    redirect(`/login?callbackUrl=/transfer/${token}`);
  }

  // Logged in but wrong email
  if (session.user.email?.toLowerCase() !== transfer.toEmail.toLowerCase()) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
        <div className="max-w-sm">
          <p className="text-lg font-semibold text-gray-900">Wrong account</p>
          <p className="mt-2 text-sm text-gray-500">
            This transfer was sent to <strong>{transfer.toEmail}</strong>. You&apos;re signed in as{" "}
            <strong>{session.user.email}</strong>. Please sign in with the correct account to continue.
          </p>
          <Link href={`/login?callbackUrl=/transfer/${token}`} className="mt-4 inline-block text-sm text-primary-600 hover:underline">
            Sign in with a different account
          </Link>
        </div>
      </div>
    );
  }

  const order = transfer.order;
  const event_ = order.ticketCategory.event;
  const isInstallment = order.usesInstallments && order.status !== "PAID_IN_FULL";
  const paidAmount = Number(order.paidAmount);
  const totalAmount = Number(order.totalAmount);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-6 text-center">
          <a href="/" className="text-xl font-black tracking-tight text-gray-900">Lumora</a>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-lg">
          {/* Banner */}
          <div className="bg-primary-600 px-6 py-6 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-primary-200">Ticket transfer</p>
            <h1 className="mt-1 text-xl font-black text-white">{event_.title}</h1>
            <p className="mt-1 text-sm text-primary-200">
              <strong className="text-white">{transfer.fromUser.name ?? transfer.fromUser.email}</strong> is transferring their{" "}
              {isInstallment ? "payment schedule" : "ticket"} to you
            </p>
          </div>

          <div className="px-6 py-6 space-y-4">
            {/* Event details */}
            <div className="rounded-xl bg-gray-50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Ticket type</span>
                <span className="font-semibold text-gray-900">{order.ticketCategory.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Date</span>
                <span className="font-semibold text-gray-900">{format(event_.date, "dd MMM yyyy · HH:mm")}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Venue</span>
                <span className="font-semibold text-gray-900">
                  {event_.venue}{event_.city ? `, ${event_.city}` : ""}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Qty</span>
                <span className="font-semibold text-gray-900">{order.quantity}</span>
              </div>
            </div>

            {/* Payment info */}
            {isInstallment ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Payment schedule transfer</p>
                <p className="text-sm text-amber-800">
                  By accepting, you take over the remaining installments. Paid so far:{" "}
                  <strong>KES {paidAmount.toLocaleString()}</strong> of{" "}
                  <strong>KES {totalAmount.toLocaleString()}</strong>.
                </p>
                {(() => {
                  const pending = order.payments.filter((p) => p.paymentNumber > 0 && p.status === "PENDING");
                  if (!pending.length) return null;
                  return (
                    <div className="space-y-1 pt-1 border-t border-amber-200">
                      {pending.map((p) => (
                        <div key={p.id} className="flex justify-between text-xs text-amber-700">
                          <span>Installment {p.paymentNumber} — due {format(p.dueDate, "dd MMM yyyy")}</span>
                          <span className="font-bold">KES {(Number(p.amount) - Number(p.paidAmount)).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                <p className="text-sm text-green-800">
                  <strong>Fully paid ticket</strong> — no further payments required.
                </p>
              </div>
            )}

            <p className="text-xs text-gray-400 text-center">
              Offer expires {format(transfer.expiresAt, "dd MMMM yyyy")}
            </p>

            <TransferActions token={token} />
          </div>
        </div>
      </div>
    </div>
  );
}
