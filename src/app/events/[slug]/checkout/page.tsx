"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button } from "@/components/ui/Button";
import { createOrder, createCartOrder } from "@/app/actions/orders";
import { getMyPhone, updateMyPhone } from "@/app/actions/profile";
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
  convenienceFee: number;
  installmentFeePercent: number;
  installmentPlan: {
    initialPaymentPercent: number;
    depositPercent: number;
    consolidatedCount: number;
    consolidatedItems: { installmentNumber: number; percentage: number; dueDate: string }[];
    scheduleItems: { installmentNumber: number; percentage: number; dueDate: string }[];
  } | null;
}

interface CartItem {
  categoryId: string;
  quantity: number;
  preview: CategoryPreview;
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Detect checkout mode
  const itemsParam = searchParams.get("items");
  const isCartCheckout = !!itemsParam;

  // Legacy single-category params (used for installments)
  const categoryId = searchParams.get("category") ?? "";
  const useInstallments = searchParams.get("installments") === "1";
  const singleQty = Math.max(1, parseInt(searchParams.get("qty") ?? "1", 10));
  const inviteToken = searchParams.get("invite") ?? undefined;

  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [singleCategory, setSingleCategory] = useState<CategoryPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [freeSuccess, setFreeSuccess] = useState<{ ticketNumbers: string[]; eventTitle: string; eventSlug: string } | null>(null);

  // Phone collection for users who signed up via Google and haven't added one yet
  const [phoneNeeded, setPhoneNeeded] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");

  useEffect(() => {
    // Check if user needs to provide a phone number
    getMyPhone().then((p) => { if (!p) setPhoneNeeded(true); });

    if (isCartCheckout) {
      const parsed = (itemsParam ?? "").split(",").map((s) => {
        const [id, qStr] = s.split(":");
        return { categoryId: id.trim(), quantity: Math.max(1, parseInt(qStr ?? "1", 10)) };
      }).filter((i) => !!i.categoryId);

      if (!parsed.length) { setLoading(false); return; }

      Promise.all(
        parsed.map((ci) =>
          fetch(`/api/categories/${ci.categoryId}/preview`)
            .then((r) => r.json())
            .then((d): CartItem => ({ categoryId: ci.categoryId, quantity: ci.quantity, preview: d }))
        )
      )
        .then((results) => { setCartItems(results); setLoading(false); })
        .catch(() => { setError("Failed to load ticket details."); setLoading(false); });
    } else {
      if (!categoryId) { setLoading(false); return; }
      fetch(`/api/categories/${categoryId}/preview`)
        .then((r) => r.json())
        .then((d) => { setSingleCategory(d); setLoading(false); })
        .catch(() => { setError("Failed to load ticket details."); setLoading(false); });
    }
  }, [isCartCheckout, itemsParam, categoryId]);

  async function handlePay() {
    setPaying(true);
    setError("");
    setPhoneError("");

    // Persist phone for OAuth users who haven't added one
    if (phoneNeeded) {
      if (!phone.trim()) {
        setPhoneError("Phone number is required to complete your purchase.");
        setPaying(false);
        return;
      }
      const phoneRes = await updateMyPhone(phone);
      if (!phoneRes.ok) {
        setPhoneError(phoneRes.error);
        setPaying(false);
        return;
      }
    }

    if (isCartCheckout) {
      const parsed = (itemsParam ?? "").split(",").map((s) => {
        const [id, qStr] = s.split(":");
        return { ticketCategoryId: id.trim(), quantity: Math.max(1, parseInt(qStr ?? "1", 10)) };
      }).filter((i) => !!i.ticketCategoryId);

      const res = await createCartOrder({ items: parsed, inviteToken });
      if (!res.ok) { setError(res.error); setPaying(false); return; }
      if (res.data.ticketNumbers) {
        setFreeSuccess({ ticketNumbers: res.data.ticketNumbers, eventTitle: cartItems[0]?.preview.eventTitle ?? "", eventSlug: cartItems[0]?.preview.eventSlug ?? "" });
        setPaying(false);
        return;
      }
      window.location.href = res.data.paymentUrl;
    } else {
      const res = await createOrder({ ticketCategoryId: categoryId, useInstallments, quantity: singleQty, inviteToken });
      if (!res.ok) { setError(res.error); setPaying(false); return; }
      if (res.data.ticketNumbers) {
        setFreeSuccess({ ticketNumbers: res.data.ticketNumbers, eventTitle: singleCategory?.eventTitle ?? "", eventSlug: singleCategory?.eventSlug ?? "" });
        setPaying(false);
        return;
      }
      window.location.href = res.data.paymentUrl;
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (freeSuccess) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6 py-12">
        <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-primary-600 px-6 py-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
              <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-black text-white">You&apos;re in!</h1>
            <p className="mt-1 text-sm text-white/80">
              {freeSuccess.ticketNumbers.length > 1
                ? `${freeSuccess.ticketNumbers.length} tickets confirmed for`
                : "Your ticket is confirmed for"}{" "}
              <span className="font-semibold">{freeSuccess.eventTitle}</span>
            </p>
          </div>

          {/* Ticket numbers */}
          <div className="px-6 py-6 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
              {freeSuccess.ticketNumbers.length > 1 ? "Your ticket numbers" : "Your ticket number"}
            </p>
            {freeSuccess.ticketNumbers.map((num, i) => (
              <div
                key={num}
                className="flex items-center justify-between rounded-xl border border-primary-100 bg-primary-50 px-4 py-3"
              >
                {freeSuccess.ticketNumbers.length > 1 && (
                  <span className="mr-3 text-xs font-bold text-primary-400">#{i + 1}</span>
                )}
                <span className="flex-1 font-mono text-base font-bold tracking-widest text-primary-700">
                  {num}
                </span>
              </div>
            ))}

            <p className="text-xs text-gray-500 leading-relaxed pt-1">
              A confirmation email with your QR code{freeSuccess.ticketNumbers.length > 1 ? "s has" : " has"} been sent to your inbox. Show the QR code at the entrance.
            </p>
          </div>

          {/* Actions */}
          <div className="border-t border-gray-100 px-6 py-4 space-y-2">
            <Link
              href="/buyer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-bold text-white hover:bg-primary-500 transition-colors"
            >
              View my tickets
            </Link>
            <Link
              href={`/events/${freeSuccess.eventSlug}`}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Back to event
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isReady = isCartCheckout ? cartItems.length > 0 : !!singleCategory;
  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        Ticket not found.
      </div>
    );
  }

  const displayCategory = isCartCheckout ? cartItems[0].preview : singleCategory!;
  const cartTotal = isCartCheckout
    ? cartItems.reduce((sum, item) => sum + item.preview.price * item.quantity, 0)
    : singleCategory!.price * singleQty;
  const isFree = cartTotal === 0;
  const convFee = isFree ? 0 : (displayCategory.convenienceFee ?? 0);
  const ticketAmountDueNow =
    !isCartCheckout && singleCategory?.installmentPlan && useInstallments
      ? Math.round((cartTotal * singleCategory.installmentPlan.initialPaymentPercent) / 100)
      : cartTotal;
  const installmentFee =
    !isCartCheckout && useInstallments && singleCategory?.installmentPlan
      ? Math.round(cartTotal * ((singleCategory.installmentFeePercent ?? 0) / 100))
      : 0;
  const initialAmount = ticketAmountDueNow + convFee + installmentFee;

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-sans">

      {/* ── Left panel — event branding ── */}
      <div className="flex flex-col bg-primary-900 md:w-[45%] md:min-h-screen">
        <div className="relative h-[42vh] w-full overflow-hidden shrink-0 md:h-[52%]">
          {displayCategory.coverImage ? (
            <img
              src={displayCategory.coverImage}
              alt={displayCategory.eventTitle}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-primary-700 via-primary-600 to-cyan-500" />
          )}
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-8 py-6 md:px-10">
            <Link href="/" className="flex items-center gap-2">
              <img src="/logo-light.svg" alt="Lumora" className="h-8 w-8 rounded-lg object-cover" />
              <span className="text-base font-black tracking-tight text-white drop-shadow">Lumora</span>
            </Link>
            <Link
              href={`/events/${displayCategory.eventSlug}`}
              className="text-xs font-semibold text-white/80 hover:text-white transition-colors drop-shadow"
            >
              ← Back to event
            </Link>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-between bg-primary-900 px-8 py-8 md:px-10 md:py-10">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-primary-400">
              You&apos;re checking out
            </p>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              {displayCategory.eventTitle}
            </h1>
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-white/60">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {format(new Date(displayCategory.eventDate), "EEEE, dd MMMM yyyy · HH:mm")}
              </div>
              <div className="flex items-center gap-2 text-sm text-white/60">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {displayCategory.venue}{displayCategory.city ? `, ${displayCategory.city}` : ""}
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {(isFree
              ? [
                  { icon: "🎟️", label: "Free entry" },
                  { icon: "⚡", label: "Instant ticket" },
                  { icon: "✓", label: "Secure & verified" },
                ]
              : [
                  { icon: "🔒", label: "Secure payment" },
                  { icon: "⚡", label: "Instant ticket" },
                  { icon: "✓", label: "IntaSend verified" },
                ]
            ).map((t) => (
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
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-lg">
            <div className="border-b border-gray-100 px-6 py-5">
              <h2 className="text-lg font-black tracking-tight text-gray-900">Order summary</h2>
            </div>

            <div className="px-6 py-5 space-y-5">

              {isCartCheckout ? (
                /* ── Multi-category cart summary ── */
                <div className="rounded-xl bg-gray-50 p-4 space-y-3">
                  {cartItems.map((item) => (
                    <div key={item.categoryId} className="space-y-0.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-gray-900">{item.preview.name}</span>
                        <span className="font-bold text-gray-900">
                          KES {(item.preview.price * item.quantity).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>{item.quantity} ticket{item.quantity > 1 ? "s" : ""}</span>
                        <span>× KES {item.preview.price.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                  {cartItems.length > 1 && (
                    <div className="flex justify-between border-t border-gray-200 pt-2 text-sm font-bold">
                      <span className="text-gray-700">Subtotal</span>
                      <span className="text-gray-900">KES {cartTotal.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              ) : (
                /* ── Single-category summary (installments supported) ── */
                <div className="rounded-xl bg-gray-50 p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Ticket type</span>
                    <span className="font-bold text-gray-900">{singleCategory!.name}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Quantity</span>
                    <span className="font-semibold text-gray-900">
                      {singleQty} ticket{singleQty > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Full price</span>
                    <span className="font-semibold text-gray-900">
                      KES {cartTotal.toLocaleString()}
                      {singleQty > 1 && (
                        <span className="ml-1 text-xs font-normal text-gray-400">
                          ({singleQty} × {singleCategory!.price.toLocaleString()})
                        </span>
                      )}
                    </span>
                  </div>

                  {useInstallments && singleCategory!.installmentPlan && (
                    <div className="mt-2 border-t border-gray-200 pt-3 space-y-1.5">
                      <p className="text-xs font-bold uppercase tracking-wider text-primary-600">
                        Installment schedule
                      </p>

                      {/* Late purchase notice */}
                      {singleCategory!.installmentPlan.consolidatedCount > 0 && (
                        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 space-y-1">
                          <p className="text-xs font-bold text-amber-800">
                            Late purchase — installments due upfront
                          </p>
                          <p className="text-xs text-amber-700 leading-relaxed">
                            {singleCategory!.installmentPlan.consolidatedCount === 1
                              ? "1 installment was already due before today."
                              : `${singleCategory!.installmentPlan.consolidatedCount} installments were already due before today.`}{" "}
                            These must be paid now along with your deposit to avoid your ticket being immediately flagged as overdue.
                          </p>
                        </div>
                      )}

                      {/* Pay now breakdown */}
                      {singleCategory!.installmentPlan.consolidatedCount > 0 ? (
                        <div className="space-y-1 rounded-lg bg-gray-50 px-3 py-2">
                          <div className="flex justify-between text-xs text-gray-600">
                            <span>Deposit ({singleCategory!.installmentPlan.depositPercent}%)</span>
                            <span>KES {Math.round((cartTotal * singleCategory!.installmentPlan.depositPercent) / 100).toLocaleString()}</span>
                          </div>
                          {singleCategory!.installmentPlan.consolidatedItems.map((item) => (
                            <div key={item.installmentNumber} className="flex justify-between text-xs text-amber-700">
                              <span>Installment {item.installmentNumber} catch-up — was due {format(new Date(item.dueDate), "dd MMM")}</span>
                              <span>KES {Math.round((cartTotal * item.percentage) / 100).toLocaleString()}</span>
                            </div>
                          ))}
                          <div className="flex justify-between text-xs font-bold text-gray-900 border-t border-gray-200 pt-1 mt-1">
                            <span>Total due now</span>
                            <span>KES {initialAmount.toLocaleString()}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">
                            Deposit ({singleCategory!.installmentPlan.initialPaymentPercent}%) — pay now
                          </span>
                          <span className="font-bold text-gray-900">KES {initialAmount.toLocaleString()}</span>
                        </div>
                      )}

                      {/* Upcoming installments */}
                      {singleCategory!.installmentPlan.scheduleItems.map((item) => (
                        <div key={item.installmentNumber} className="flex justify-between text-xs text-gray-500">
                          <span>
                            Installment {item.installmentNumber} ({item.percentage}%) — {format(new Date(item.dueDate), "dd MMM yyyy")}
                          </span>
                          <span>KES {Math.round((cartTotal * item.percentage) / 100).toLocaleString()}</span>
                        </div>
                      ))}

                      <p className="border-t border-gray-100 pt-1 text-[10px] text-gray-400">
                        Missed payments may result in ticket revocation. All payments are non-refundable.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Phone number — shown only for users who haven't added one (Google OAuth) */}
              {phoneNeeded && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Your phone number</p>
                      <p className="text-xs text-gray-500">Used for ticket support and event updates. Saved to your profile.</p>
                    </div>
                  </div>
                  <input
                    type="tel"
                    placeholder="+254 700 000 000"
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); setPhoneError(""); }}
                    className={`w-full rounded-lg border px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors ${
                      phoneError
                        ? "border-red-400 bg-red-50 focus:border-red-500"
                        : "border-gray-200 bg-white focus:border-primary-500"
                    }`}
                  />
                  {phoneError && (
                    <p className="text-xs text-red-600">{phoneError}</p>
                  )}
                </div>
              )}

              {/* Fee line items */}
              {!isFree && (
                <div className="space-y-1.5 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between text-gray-600">
                    <span>Tickets subtotal</span>
                    <span className="font-semibold text-gray-800">KES {ticketAmountDueNow.toLocaleString()}</span>
                  </div>
                  {installmentFee > 0 && (
                    <div className="flex items-center justify-between text-gray-600">
                      <span>Installment fee ({singleCategory?.installmentFeePercent ?? 0}%)</span>
                      <span className="font-semibold text-gray-800">KES {installmentFee.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-gray-600">
                    <span>Processing fee</span>
                    <span className="font-semibold text-gray-800">KES {convFee.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* Due now */}
              <div className="flex items-center justify-between rounded-xl bg-primary-50 px-4 py-3">
                <span className="font-bold text-gray-900">{isFree ? "Total" : "Due now"}</span>
                <span className="text-2xl font-black text-primary-600">
                  {isFree ? "Free" : `KES ${initialAmount.toLocaleString()}`}
                </span>
              </div>

              {error && (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
              )}

              {!isFree && (
                <p className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700 leading-relaxed">
                  <span className="font-bold">Refund policy:</span> Tickets are non-refundable once purchased. Installment deposits are non-refundable upon default or cancellation. Refunds are only issued if the event organiser cancels the event.{" "}
                  <a href="/terms" target="_blank" className="underline font-semibold">Full terms →</a>
                </p>
              )}

              <Button className="w-full" size="lg" loading={paying} onClick={handlePay}>
                {isFree ? (
                  <>
                    <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                    </svg>
                    Get my free ticket
                  </>
                ) : (
                  <>
                    <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Pay securely
                  </>
                )}
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

export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutContent />
    </Suspense>
  );
}
