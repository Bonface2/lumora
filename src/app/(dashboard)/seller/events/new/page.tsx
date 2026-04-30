import { CreateEventForm } from "./CreateEventForm";

export const metadata = { title: "Create Event" };

export default function NewEventPage() {
  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <a href="/seller" className="text-sm text-primary-600 hover:underline">← Back to events</a>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Create a new event</h1>
        <p className="mt-1 text-sm text-gray-500">Fill in the details below and configure your ticket categories.</p>
      </div>
      <CreateEventForm />
    </div>
  );
}
