"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { createOrder } from "@/app/actions/orders";

// Data is fetched via a small API route to keep this page a client component
// while still accessing the DB for the category preview.
interface CategoryPreview {
  name: string;
  price: number;
  eventTitle: string;
  eventDate: string;
  venue: string;
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
    // Redirect to Paystack
    window.location.href = res.data.paymentUrl;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <a href="/" className="text-xl font-bold text-violet-600">Lumora</a>
        </div>

        <Card>
          <CardHeader>
            <h1 className="font-semibold text-gray-900">Order summary</h1>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <p className="font-medium text-gray-900">{category.eventTitle}</p>
              <p className="text-sm text-gray-500">
                {format(new Date(category.eventDate), "dd MMM yyyy")} · {category.venue}
              </p>
            </div>

            <div className="rounded-lg bg-gray-50 p-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Ticket type</span>
                <span className="font-medium">{category.name}</span>
              </div>
              <div className="mt-1 flex justify-between text-sm">
                <span className="text-gray-600">Quantity</span>
                <span>{quantity} ticket{quantity > 1 ? "s" : ""}</span>
              </div>
              <div className="mt-1 flex justify-between text-sm">
                <span className="text-gray-600">Full price</span>
                <span>KES {total.toLocaleString()}{quantity > 1 ? ` (${quantity} × ${category.price.toLocaleString()})` : ""}</span>
              </div>
              {useInstallments && category.installmentPlan && (
                <>
                  <div className="mt-2 border-t border-gray-200 pt-2">
                    <p className="text-xs font-medium text-violet-700 mb-1.5">Installment schedule</p>
                    <div className="space-y-1">
                      {category.installmentPlan.consolidatedCount > 0 && (
                        <p className="mb-1.5 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
                          {category.installmentPlan.consolidatedCount} overdue installment{category.installmentPlan.consolidatedCount > 1 ? "s have" : " has"} been added to your deposit.
                        </p>
                      )}
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Deposit ({category.installmentPlan.initialPaymentPercent}%) — pay now</span>
                        <span className="font-medium text-gray-900">KES {initialAmount.toLocaleString()}</span>
                      </div>
                      {category.installmentPlan.scheduleItems.map((item) => (
                        <div key={item.installmentNumber} className="flex justify-between text-xs text-gray-500">
                          <span>
                            Installment {item.installmentNumber} ({item.percentage}%) —{" "}
                            {format(new Date(item.dueDate), "dd MMM yyyy")}
                          </span>
                          <span>KES {Math.round((total * item.percentage) / 100).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-gray-400">
                    Missed payments may result in ticket revocation. All payments are non-refundable.
                  </p>
                </>
              )}
            </div>

            <div className="flex items-center justify-between border-t pt-3">
              <span className="font-semibold text-gray-900">Due now</span>
              <span className="text-xl font-bold text-violet-600">
                KES {initialAmount.toLocaleString()}
              </span>
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <Button className="w-full" size="lg" loading={paying} onClick={handlePay}>
              Pay with Paystack
            </Button>

            <button
              type="button"
              onClick={() => router.back()}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
            >
              ← Go back
            </button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
