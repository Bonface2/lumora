"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { payInstallment } from "@/app/actions/orders";

interface PaymentPreview {
  eventTitle: string;
  eventDate: string;
  venue: string;
  categoryName: string;
  installmentNumber: number;
  amount: number;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
}

export default function PayInstallmentPage() {
  const { id: orderId } = useParams<{ id: string }>();
  const router = useRouter();
  const [preview, setPreview] = useState<PaymentPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/buyer/orders/${orderId}/next-payment`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setPreview(d);
        setLoading(false);
      })
      .catch(() => { setError("Failed to load payment details."); setLoading(false); });
  }, [orderId]);

  async function handlePay() {
    setPaying(true);
    setError("");
    const res = await payInstallment(orderId);
    if (!res.ok) {
      setError(res.error);
      setPaying(false);
      return;
    }
    window.location.href = res.data.paymentUrl;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        {error || "Payment not found."}
      </div>
    );
  }

  const progressPct = Math.min(100, Math.round((preview.paidAmount / preview.totalAmount) * 100));

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <a href="/" className="text-xl font-bold text-violet-600">Lumora</a>
        </div>

        <Card>
          <CardHeader>
            <h1 className="font-semibold text-gray-900">Pay installment</h1>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <p className="font-medium text-gray-900">{preview.eventTitle}</p>
              <p className="text-sm text-gray-500">
                {format(new Date(preview.eventDate), "dd MMM yyyy · HH:mm")} · {preview.venue}
              </p>
            </div>

            <div className="rounded-lg bg-gray-50 p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Ticket type</span>
                <span className="font-medium">{preview.categoryName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Installment</span>
                <span className="font-medium">#{preview.installmentNumber}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Due date</span>
                <span className="font-medium">{format(new Date(preview.dueDate), "dd MMM yyyy")}</span>
              </div>

              <div className="border-t border-gray-200 pt-2">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Payment progress</span>
                  <span>KES {preview.paidAmount.toLocaleString()} / {preview.totalAmount.toLocaleString()}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-gray-200">
                  <div
                    className="h-1.5 rounded-full bg-violet-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t pt-3">
              <span className="font-semibold text-gray-900">Due now</span>
              <span className="text-xl font-bold text-violet-600">
                KES {preview.amount.toLocaleString()}
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
              onClick={() => router.push("/buyer")}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
            >
              ← Back to my tickets
            </button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
