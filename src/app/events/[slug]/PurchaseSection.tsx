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
  const [selected, setSelected] = useState<string | null>(null);
  const [useInstallments, setUseInstallments] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const selectedCategory = categories.find((c) => c.id === selected);
  const remaining = selectedCategory
    ? selectedCategory.totalQuantity - selectedCategory.soldQuantity
    : 0;

  function handleBuy() {
    if (!isLoggedIn) {
      router.push(
        `/login?callbackUrl=/events/${window.location.pathname.split("/events/")[1]}`
      );
      return;
    }
    if (!selected) return;
    const params = new URLSearchParams({
      category: selected,
      installments: useInstallments ? "1" : "0",
      qty: String(quantity),
    });
    router.push(`${window.location.pathname}/checkout?${params}`);
  }

  return (
    <div className="space-y-3">
      {categories.map((cat) => {
        const soldOut = cat.soldQuantity >= cat.totalQuantity;
        const isSelected = selected === cat.id;
        const initialAmount = cat.installmentPlan
          ? (cat.price * cat.installmentPlan.initialPaymentPercent) / 100
          : cat.price;

        return (
          <button
            key={cat.id}
            type="button"
            disabled={soldOut}
            onClick={() => {
              setSelected(isSelected ? null : cat.id);
              setUseInstallments(false);
              setQuantity(1);
            }}
            className={`w-full rounded-xl border-2 p-4 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              isSelected
                ? "border-primary-500 bg-primary-50"
                : "border-gray-200 bg-white hover:border-primary-300"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900">{cat.name}</p>
                  {cat.allowInstallments && (
                    <Badge variant="primary">Installments</Badge>
                  )}
                  {soldOut && <Badge variant="danger">Sold out</Badge>}
                </div>
                {cat.description && (
                  <p className="mt-0.5 text-xs text-gray-500">{cat.description}</p>
                )}
              </div>
              <p className="font-bold text-gray-900">
                KES {cat.price.toLocaleString()}
              </p>
            </div>

            {/* Installment section — always visible when selected */}
            {isSelected && cat.allowInstallments && cat.installmentPlan && (
              <div className="mt-3 border-t border-primary-200 pt-3 space-y-3">
                {/* Schedule breakdown — always shown */}
                <div className="rounded-lg bg-white border border-primary-200 p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between font-medium text-gray-700">
                    <span>Deposit ({cat.installmentPlan.initialPaymentPercent}%) — pay now</span>
                    <span>KES {Math.round(initialAmount).toLocaleString()}</span>
                  </div>
                  {cat.installmentPlan.scheduleItems.map((item) => (
                    <div key={item.installmentNumber} className="flex justify-between text-gray-500">
                      <span>
                        Installment {item.installmentNumber} ({item.percentage}%) —{" "}
                        due {format(new Date(item.dueDate), "dd MMM yyyy")}
                      </span>
                      <span>
                        KES {Math.round((cat.price * item.percentage) / 100).toLocaleString()}
                      </span>
                    </div>
                  ))}
                  <p className="pt-1 text-gray-400 border-t border-gray-100">
                    Missed payments may result in ticket revocation. All payments are non-refundable.
                  </p>
                </div>

                {/* Toggle */}
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
                  <span className="text-sm font-medium text-gray-700">
                    Pay in installments
                  </span>
                </label>
              </div>
            )}
          </button>
        );
      })}

      {selected && (
        <>
          {/* Quantity stepper */}
          <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
            <span className="text-sm font-medium text-gray-700">Quantity</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                −
              </button>
              <span className="w-6 text-center font-semibold">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(remaining, q + 1))}
                disabled={quantity >= remaining}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>

          <Button className="w-full" size="lg" onClick={handleBuy}>
            {useInstallments
              ? `Pay KES ${Math.round(
                  (selectedCategory!.price * quantity *
                    selectedCategory!.installmentPlan!.initialPaymentPercent) /
                    100
                ).toLocaleString()} deposit${quantity > 1 ? ` × ${quantity} tickets` : ""}`
              : `Buy ${quantity > 1 ? `${quantity} tickets` : ""} — KES ${(
                  selectedCategory!.price * quantity
                ).toLocaleString()}`}
          </Button>
        </>
      )}

      {!isLoggedIn && selected && (
        <p className="text-center text-xs text-gray-500">
          You&apos;ll be asked to sign in before completing your purchase.
        </p>
      )}
    </div>
  );
}
