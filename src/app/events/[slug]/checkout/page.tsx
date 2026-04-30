"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button } from "@/components/ui/Button";
import { createOrder } from "@/app/actions/orders";
import Link from "next/link";

interface CategoryPreview {
  name: string;
  price: number;
  eventTitle: string;
  eventDate: string;
  venue: string;
  city: string | null;
  coverImage: string | null;
  eventSlug: string;
  allowInstallments: boolean;
  installmentPlan: {
    initialPaymentPercent: number;
    consolidatedCount: number;
    scheduleItems: { installmentNumber: number; percentage: number; dueDate: string }[];
  } | null;
}

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const categoryId = searchParams.get("category") ?? "";
  const useInstallments = searchParams.get("installments") === "1";
  const quantity = Math.max(1, parseInt(searchParams.get("qty") ?? "1", 10));

  const [category, setCategory] = useState<CategoryPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!categoryId) return;
    fetch(`/api/categories/${categoryId}/preview`)
      .then((r) => r.json())
      .then((d) => { setCategory(d); setLoading(false); })
      .catch(() => { setError("Failed to load ticket details."); setLoading(false); });
  }, [categoryId]);

  async function handlePay() {
    setPaying(true);
    setError("");
    const res = await createOrder({ ticketCategoryId: categoryId, useInstallments, quantity });
    if (!res.ok) {
      setError(res.error);
      setPaying(false);
      return;
    }
    window.location.href = res.data.paymentUrl;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        Ticket not found.
      </div>
    );
  }

  const total = category.price * quantity;
  const initialAmount = category.installmentPlan && useInstallments
    ? Math.round((total * category.installmentPlan.initialPaymentPercent) / 100)
    : total;

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-sans">

      {/* ── Left panel — event branding ── */}
      <div className="flex flex-col bg-primary-900 md:w-[45%] md:min-h-screen">

        {/* Image section — top portion */}
        <div className="relative h-[42vh] w-full overflow-hidden shrink-0 md:h-[52%]">
          {category.coverImage ? (
            <img
              src={category.coverImage}
              alt={category.eventTitle}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-primary-700 via-primary-600 to-cyan-500" />
          )}
          {/* Dot texture */}
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          {/* Logo + back — overlaid on image */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-8 py-6 md:px-10">
            <Link href="/" className="flex items-center gap-2">
              <img src="/logo.svg" alt="Lumora" className="h-8 w-8 rounded-lg object-cover" />
              <span className="text-base font-black tracking-tight text-white drop-shadow">Lumora</span>
            </Link>
            <Link
              href={`/events/${category.eventSlug}`}
              className="text-xs font-semibold text-white/80 hover:text-white transition-colors drop-shadow"
            >
              ← Back to event
            </Link>
          </div>
        </div>

        {/* Text section — deep teal background */}
        <div className="flex flex-1 flex-col justify-between bg-primary-900 px-8 py-8 md:px-10 md:py-10">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-primary-400">
              You&apos;re checking out
            </p>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              {category.eventTitle}
            </h1>
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-white/60">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {format(new Date(category.eventDate), "EEEE, dd MMMM yyyy · HH:mm")}
              </div>
              <div className="flex items-center gap-2 text-sm text-white/60">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {category.venue}{category.city ? `, ${category.city}` : ""}
              </div>
            </div>
          </div>

          {/* Trust signals — pinned to bottom of text section */}
          <div className="mt-8 flex flex-wrap gap-3">
            {[
              { icon: "🔒", label: "Secure payment" },
              { icon: "⚡", label: "Instant ticket" },
              { icon: "✓",  label: "Paystack verified" },
            ].map((t) => (
              <span
                key={t.label}
                className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/70"
              >
                <span>{t.icon}</span> {t.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel — order summary ── */}
      <div className="flex flex-1 items-start justify-center bg-gray-50 px-6 py-10 md:items-center md:px-10">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-lg">
            {/* Card header strip */}
            <div className="border-b border-gray-100 px-6 py-5">
              <h2 className="text-lg font-black tracking-tight text-gray-900">Order summary</h2>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Ticket details */}
              <div className="rounded-xl bg-gray-50 p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Ticket type</span>
                  <span className="font-bold text-gray-900">{category.name}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Quantity</span>
                  <span className="font-semibold text-gray-900">{quantity} ticket{quantity > 1 ? "s" : ""}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Full price</span>
                  <span className="font-semibold text-gray-900">
                    KES {total.toLocaleString()}
                    {quantity > 1 && (
                      <span className="ml-1 text-xs font-normal text-gray-400">
                        ({quantity} × {category.price.toLocaleString()})
                      </span>
                    )}
                  </span>
                </div>

                {/* Installment schedule */}
                {useInstallments && category.installmentPlan && (
                  <div className="mt-2 border-t border-gray-200 pt-3 space-y-1.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-primary-600">
                      Installment schedule
                    </p>
                    {category.installmentPlan.consolidatedCount > 0 && (
                      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        {category.installmentPlan.consolidatedCount} overdue installment{category.installmentPlan.consolidatedCount > 1 ? "s have" : " has"} been added to your deposit.
                      </p>
                    )}
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">
                        Deposit ({category.installmentPlan.initialPaymentPercent}%) — pay now
                      </span>
                      <span className="font-bold text-gray-900">KES {initialAmount.toLocaleString()}</span>
                    </div>
                    {category.installmentPlan.scheduleItems.map((item) => (
                      <div key={item.installmentNumber} className="flex justify-between text-xs text-gray-500">
                        <span>
                          Installment {item.installmentNumber} ({item.percentage}%) — {format(new Date(item.dueDate), "dd MMM yyyy")}
                        </span>
                        <span>KES {Math.round((total * item.percentage) / 100).toLocaleString()}</span>
                      </div>
                    ))}
                    <p className="pt-1 text-[10px] text-gray-400 border-t border-gray-100">
                      Missed payments may result in ticket revocation. All payments are non-refundable.
                    </p>
                  </div>
                )}
              </div>

              {/* Due now */}
              <div className="flex items-center justify-between rounded-xl bg-primary-50 px-4 py-3">
                <span className="font-bold text-gray-900">Due now</span>
                <span className="text-2xl font-black text-primary-600">
                  KES {initialAmount.toLocaleString()}
                </span>
              </div>

              {error && (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
              )}

              <Button className="w-full" size="lg" loading={paying} onClick={handlePay}>
                <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Pay with Paystack
              </Button>

              <button
                type="button"
                onClick={() => router.back()}
                className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                ← Go back
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
