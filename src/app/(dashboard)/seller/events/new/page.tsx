import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPayoutMethods } from "@/app/actions/payout";
import { NewEventFlow } from "./NewEventFlow";
import type { CreateEventFormData } from "@/lib/schemas/event";

export const metadata = { title: "Create Event" };

export default async function NewEventPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const payoutMethods = await getPayoutMethods();

  const defaultValues: CreateEventFormData = {
    title: "",
    description: "",
    date: "",
    endDate: "",
    venue: "",
    city: "",
    coverImage: "",
    payoutMethodId: payoutMethods.length === 1 ? payoutMethods[0].id : "",
    eventType: "PAID",
    experienceType: "PUBLIC",
    isPrivate: false,
    ticketCategories: [
      {
        name: "",
        price: 0,
        totalQuantity: 0,
        allowInstallments: false,
        sortOrder: 0,
        installmentPlan: { initialPaymentPercent: 30, gracePeriodDays: 7, scheduleItems: [] },
      },
    ],
  };

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-6 text-center">
        <a href="/seller" className="text-sm text-primary-600 hover:underline">← My experiences</a>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Create a new experience</h1>
        <p className="mt-1 text-sm text-gray-500">Fill in the details below and configure your ticket categories.</p>
      </div>
      <NewEventFlow payoutMethods={payoutMethods} defaultValues={defaultValues} />
    </div>
  );
}
