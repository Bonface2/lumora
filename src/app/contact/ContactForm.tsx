"use client";

import { useActionState } from "react";
import { submitContactForm } from "@/app/actions/contact";

const initialState = { ok: false, error: undefined as string | undefined };

export function ContactForm() {
  const [state, action, pending] = useActionState(submitContactForm, initialState);

  if (state.ok) {
    return (
      <div className="rounded-2xl border border-green-100 bg-green-50 p-8 flex flex-col items-center text-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-base font-bold text-gray-900">Message sent!</p>
        <p className="text-sm text-gray-500">We&apos;ll get back to you within 1 business day.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-8">
      <h2 className="text-xl font-black tracking-tight text-gray-900 mb-6">Send us a message</h2>
      <form action={action} className="space-y-4">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-gray-500">
            Your name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="Jane Doe"
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 placeholder-gray-400 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition"
          />
        </div>

        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-gray-500">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="jane@example.com"
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 placeholder-gray-400 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition"
          />
        </div>

        <div>
          <label htmlFor="subject" className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-gray-500">
            Subject
          </label>
          <input
            id="subject"
            name="subject"
            type="text"
            required
            placeholder="e.g. Ticket refund request"
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 placeholder-gray-400 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition"
          />
        </div>

        <div>
          <label htmlFor="message" className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-gray-500">
            Message
          </label>
          <textarea
            id="message"
            name="message"
            required
            rows={5}
            placeholder="Tell us how we can help..."
            className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 placeholder-gray-400 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition"
          />
        </div>

        {state.error && (
          <p className="text-sm text-red-600">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-primary-600 px-6 py-3.5 text-sm font-bold tracking-wide text-white hover:bg-primary-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pending ? "Sending…" : "Send message"}
        </button>
      </form>
    </div>
  );
}
