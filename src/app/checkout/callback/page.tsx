import { redirect } from "next/navigation";
import { verifyPayment } from "@/lib/intasend";
import { db } from "@/lib/db";
import { finalizeOrderFromCallback } from "@/app/actions/orders";
import Link from "next/link";

export default async function CallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string; invoice_id?: string }>;
}) {
  const { reference, trxref, invoice_id } = await searchParams;
  const ref = reference ?? trxref;

  if (!ref) redirect("/");

  // Resolve the IntaSend invoice_id: prefer URL param (IntaSend appends it on redirect),
  // fall back to the stored providerRef in the transaction record.
  let invoiceId = invoice_id;
  if (!invoiceId) {
    const txn = await db.paymentTransaction.findUnique({
      where: { reference: ref },
      select: { providerRef: true },
    });
    invoiceId = txn?.providerRef ?? undefined;
  }

  let verified = false;
  let amountKes = 0;
  try {
    if (invoiceId) {
      const result = await verifyPayment(invoiceId);
      verified = result.verified;
      amountKes = result.amount;
    }
  } catch {
    verified = false;
  }

  if (!verified) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Payment failed</h1>
        <p className="mt-2 text-gray-500">Your payment could not be verified. No charge was made.</p>
        <Link href="/" className="mt-6 text-primary-600 hover:underline text-sm">
          Back to home
        </Link>
      </div>
    );
  }

  // Payment verified — finalize even if webhook already fired (idempotent).
  await finalizeOrderFromCallback(ref, amountKes);

  // Reload transaction with updated order state
  const transaction = await db.paymentTransaction.findUnique({
    where: { reference: ref },
    include: { order: { include: { tickets: true, ticketCategory: { include: { event: true } } } } },
  });

  const tickets = transaction?.order?.tickets ?? [];
  const event = transaction?.order?.ticketCategory?.event;
  const txMeta = transaction?.metadata as Record<string, unknown> | null;
  const orderStatus = transaction?.order?.status;
  const isFullyPaid = orderStatus === "PAID_IN_FULL";
  const isDeposit = txMeta?.useInstallments === true && !isFullyPaid;
  const isFollowOn = txMeta?.isFollowOn === true && !isFullyPaid;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-gray-900">
        {isDeposit ? "Deposit confirmed!" : isFollowOn ? "Payment received!" : "You're in!"}
      </h1>
      {event && (
        <p className="mt-2 text-gray-600">
          <span className="font-medium">{event.title}</span>
        </p>
      )}
      {isFullyPaid && tickets.length > 0 && (
        <div className="mt-4 w-full max-w-xs space-y-2">
          {tickets.map((t) => (
            <div key={t.id} className="rounded-xl border border-gray-200 bg-white px-8 py-4 shadow-sm">
              <p className="text-sm text-gray-500">Ticket number</p>
              <p className="mt-1 text-xl font-mono font-bold text-primary-600">
                {t.ticketNumber}
              </p>
            </div>
          ))}
        </div>
      )}
      {isFullyPaid && (
        <p className="mt-4 max-w-sm text-sm text-emerald-700 bg-emerald-50 rounded-lg px-4 py-3">
          Payment complete — your ticket is fully paid and confirmed.
        </p>
      )}
      {isDeposit && (
        <p className="mt-4 max-w-sm text-sm text-amber-700 bg-amber-50 rounded-lg px-4 py-3">
          Your deposit is confirmed. Check your email for the installment schedule.
        </p>
      )}
      {isFollowOn && (
        <p className="mt-4 max-w-sm text-sm text-amber-700 bg-amber-50 rounded-lg px-4 py-3">
          Payment recorded. Check your email for an updated balance.
        </p>
      )}
      <p className="mt-4 text-sm text-gray-500">
        A confirmation has been sent to your email.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/buyer"
          className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          View my tickets
        </Link>
        <Link href="/" className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Back to home
        </Link>
      </div>
    </div>
  );
}
