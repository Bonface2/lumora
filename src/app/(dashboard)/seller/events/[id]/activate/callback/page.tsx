import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { verifyPayment } from "@/lib/intasend";
import { db } from "@/lib/db";
import Link from "next/link";

export default async function ActivateCallbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reference?: string; invoice_id?: string }>;
}) {
  const { id } = await params;
  const { reference, invoice_id } = await searchParams;

  if (!reference) redirect(`/seller/events/${id}`);

  const session = await auth();
  if (!session?.user) redirect("/login");

  // IntaSend appends invoice_id to the redirect URL; fall back to DB lookup.
  let invoiceId = invoice_id;
  if (!invoiceId) {
    const txn = await db.paymentTransaction.findFirst({
      where: { reference },
      select: { providerRef: true },
    });
    invoiceId = txn?.providerRef ?? undefined;
  }

  let verified = false;
  let paidAmount = 0;
  try {
    if (invoiceId) {
      const result = await verifyPayment(invoiceId);
      verified = result.verified;
      paidAmount = result.amount;
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
        <h1 className="text-2xl font-bold text-gray-900">Payment not confirmed</h1>
        <p className="mt-2 text-sm text-gray-500">
          We could not verify your payment. If you were charged, please contact support.
        </p>
        <Link
          href={`/seller/events/${id}/activate`}
          className="mt-6 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
        >
          Try again
        </Link>
      </div>
    );
  }

  // Update DB — idempotent; won't re-run if already marked paid
  const event = await db.event.findFirst({
    where: { id, sellerId: session.user.id },
    select: { platformFeePaid: true, experienceType: true },
  });

  if (event && !event.platformFeePaid) {
    await db.event.update({
      where: { id },
      data: {
        platformFeePaid: true,
        ...(paidAmount > 0 ? { platformFeeAmount: paidAmount } : {}),
      },
    });
  }

  const isGroupTrip = event?.experienceType === "GROUP_TRIP";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-gray-900">
        {isGroupTrip ? "Listing fee paid!" : "Event activated!"}
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        {isGroupTrip
          ? "Your listing fee was received. Your group trip is now ready to publish."
          : "Your payment was received. Your event is now ready to publish."}
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href={`/seller/events/${id}`}
          className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
        >
          Go to event
        </Link>
      </div>
    </div>
  );
}
