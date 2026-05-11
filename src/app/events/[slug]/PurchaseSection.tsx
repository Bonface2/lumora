"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface ScheduleItem {
  installmentNumber: number;
  percentage: number;
  dueDate: string;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  price: number;
  totalQuantity: number;
  soldQuantity: number;
  allowInstallments: boolean;
  installmentPlan: {
    initialPaymentPercent: number;
    gracePeriodDays: number;
    scheduleItems: ScheduleItem[];
  } | null;
}

interface Props {
  event: { id: string; date: string; endDate: string | null };
  categories: Category[];
  isLoggedIn: boolean;
}

export function PurchaseSection({ categories, isLoggedIn }: Props) {
  const router = useRouter();
  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [useInstallments, setUseInstallments] = useState(false);

  const cartEntries = [...cart.entries()];
  const totalTickets = cartEntries.reduce((sum, [, qty]) => sum + qty, 0);
  const singleEntry = cartEntries.length === 1 ? cartEntries[0] : null;
  const singleCat = singleEntry ? categories.find((c) => c.id === singleEntry[0]) : null;
  const canUseInstallments = !!singleCat?.allowInstallments && !!singleCat?.installmentPlan;
  const cartHasInstallmentCategories =
    cartEntries.length > 1 &&
    cartEntries.some(([id]) => categories.find((c) => c.id === id)?.allowInstallments);

  const totalAmount = cartEntries.reduce((sum, [id, qty]) => {
    const cat = categories.find((c) => c.id === id);
    return sum + (cat ? cat.price * qty : 0);
  }, 0);

  function toggleCart(catId: string) {
    setCart((prev) => {
      const next = new Map(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.set(catId, 1);
      }
      return next;
    });
    setUseInstallments(false);
  }

  function adjustQty(catId: string, delta: number) {
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return;
    const remaining = cat.totalQuantity - cat.soldQuantity;
    setCart((prev) => {
      const next = new Map(prev);
      const current = next.get(catId) ?? 1;
      next.set(catId, Math.max(1, Math.min(remaining, current + delta)));
      return next;
    });
  }

  function handleBuy() {
    if (cart.size === 0) return;

    let checkoutUrl: string;

    if (singleEntry && useInstallments && canUseInstallments) {
      const params = new URLSearchParams({
        category: singleEntry[0],
        installments: "1",
        qty: String(singleEntry[1]),
      });
      checkoutUrl = `${window.location.pathname}/checkout?${params}`;
    } else {
      const items = cartEntries.map(([id, qty]) => `${id}:${qty}`).join(",");
      checkoutUrl = `${window.location.pathname}/checkout?items=${encodeURIComponent(items)}`;
    }

    if (!isLoggedIn) {
      router.push(`/login?callbackUrl=${encodeURIComponent(checkoutUrl)}`);
      return;
    }
    router.push(checkoutUrl);
  }

  return (
    <div className="space-y-3">
      {categories.map((cat) => {
        const soldOut = cat.soldQuantity >= cat.totalQuantity;
        const inCart = cart.has(cat.id);
        const qty = cart.get(cat.id) ?? 1;
        const remaining = cat.totalQuantity - cat.soldQuantity;

        return (
          <div
            key={cat.id}
            role="button"
            tabIndex={soldOut ? -1 : 0}
            aria-disabled={soldOut}
            onClick={() => !soldOut && toggleCart(cat.id)}
            onKeyDown={(e) => e.key === "Enter" && !soldOut && toggleCart(cat.id)}
            className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
              soldOut ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
            } ${
              inCart
                ? "border-primary-500 bg-primary-50"
                : "border-gray-200 bg-white hover:border-primary-300"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-gray-900">{cat.name}</p>
                  {cat.allowInstallments && <Badge variant="primary">Installments</Badge>}
                  {soldOut && <Badge variant="danger">Sold out</Badge>}
                </div>
                {cat.description && (
                  <p className="mt-0.5 text-xs text-gray-500">{cat.description}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <p className="font-bold text-gray-900">KES {cat.price.toLocaleString()}</p>
                {!soldOut && (
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      inCart ? "border-primary-500 bg-primary-500" : "border-gray-300"
                    }`}
                  >
                    {inCart && (
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Per-card controls — visible when in cart */}
            {inCart && (
              <div
                className="mt-3 space-y-3 border-t border-primary-200 pt-3"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Quantity stepper */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">Quantity</span>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => adjustQty(cat.id, -1)}
                      disabled={qty <= 1}
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-sm font-semibold">{qty}</span>
                    <button
                      type="button"
                      onClick={() => adjustQty(cat.id, +1)}
                      disabled={qty >= remaining}
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Installment controls — only when this is the sole cart item */}
                {cart.size === 1 && cat.allowInstallments && cat.installmentPlan && (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-primary-200 bg-white p-3 space-y-1.5 text-xs">
                      <div className="flex justify-between font-medium text-gray-700">
                        <span>Deposit ({cat.installmentPlan.initialPaymentPercent}%) — pay now</span>
                        <span>KES {Math.round((cat.price * qty * cat.installmentPlan.initialPaymentPercent) / 100).toLocaleString()}</span>
                      </div>
                      {cat.installmentPlan.scheduleItems.map((item) => (
                        <div key={item.installmentNumber} className="flex justify-between text-gray-500">
                          <span>
                            Installment {item.installmentNumber} ({item.percentage}%) — due{" "}
                            {format(new Date(item.dueDate), "dd MMM yyyy")}
                          </span>
                          <span>
                            KES {Math.round((cat.price * qty * item.percentage) / 100).toLocaleString()}
                          </span>
                        </div>
                      ))}
                      <p className="border-t border-gray-100 pt-1 text-gray-400">
                        Missed payments may result in ticket revocation. All payments are non-refundable.
                      </p>
                    </div>

                    <label
                      className="flex cursor-pointer items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="relative inline-flex items-center">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={useInstallments}
                          onChange={(e) => setUseInstallments(e.target.checked)}
                        />
                        <span className="h-5 w-9 rounded-full bg-gray-300 transition-colors peer-checked:bg-primary-600 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4" />
                      </div>
                      <span className="text-sm font-medium text-gray-700">Pay in installments</span>
                    </label>
                  </div>
                )}

                {/* Notice when installment category is mixed with others */}
                {cart.size > 1 && cat.allowInstallments && (
                  <p className="text-xs text-amber-600">
                    Installments unavailable when purchasing multiple categories at once.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Cart footer */}
      {cart.size > 0 && (
        <>
          {/* Multi-item summary strip */}
          {cart.size > 1 && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 space-y-1">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                Cart summary
              </p>
              {cartEntries.map(([id, qty]) => {
                const cat = categories.find((c) => c.id === id)!;
                return (
                  <div key={id} className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {cat.name} × {qty}
                    </span>
                    <span className="font-semibold text-gray-900">
                      KES {(cat.price * qty).toLocaleString()}
                    </span>
                  </div>
                );
              })}
              <div className="flex justify-between border-t border-gray-200 pt-2 text-sm font-bold">
                <span className="text-gray-700">Total</span>
                <span className="text-primary-600">KES {totalAmount.toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* Installment + multi-category conflict alert */}
          {cartHasInstallmentCategories && (
            <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>
                <span className="font-semibold">Installments aren&apos;t available for multi-category purchases.</span>{" "}
                To pay in instalments, buy one category at a time — complete this purchase first, then return to add the other.
              </p>
            </div>
          )}

          <Button className="w-full" size="lg" onClick={handleBuy}>
            {useInstallments && singleEntry && canUseInstallments
              ? `Pay KES ${Math.round(
                  (singleCat!.price * singleEntry[1] * singleCat!.installmentPlan!.initialPaymentPercent) /
                    100
                ).toLocaleString()} deposit${singleEntry[1] > 1 ? ` × ${singleEntry[1]} tickets` : ""}`
              : totalAmount === 0
              ? `Get ${totalTickets > 1 ? `${totalTickets} free tickets` : "free ticket"}`
              : `Buy ${totalTickets > 1 ? `${totalTickets} tickets` : "ticket"} — KES ${totalAmount.toLocaleString()}`}
          </Button>
        </>
      )}

      {!isLoggedIn && cart.size > 0 && (
        <p className="text-center text-xs text-gray-500">
          You&apos;ll be asked to sign in before completing your purchase.
        </p>
      )}
    </div>
  );
}
