"use client";

interface Props {
  onSelect: (type: "FREE" | "PAID") => void;
}

export function EventTypeSelector({ onSelect }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* Paid */}
      <button
        type="button"
        onClick={() => onSelect("PAID")}
        className="group relative flex flex-col rounded-2xl border-2 border-gray-200 bg-white p-6 text-left transition-all hover:border-primary-500 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50">
          <svg className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
          </svg>
        </div>
        <h3 className="mb-1.5 text-lg font-black text-gray-900">Paid experience</h3>
        <p className="mb-4 text-sm leading-relaxed text-gray-500">
          You set the ticket price. Revenue flows directly to your payout account after the event.
        </p>
        <div className="mt-auto flex items-center gap-2">
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
            No extra fee
          </span>
        </div>
        <div className="mt-4 flex items-center gap-1.5 font-semibold text-primary-600 group-hover:text-primary-700">
          Continue
          <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>

      {/* Free */}
      <button
        type="button"
        onClick={() => onSelect("FREE")}
        className="group relative flex flex-col rounded-2xl border-2 border-gray-200 bg-white p-6 text-left transition-all hover:border-primary-500 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50">
          <svg className="h-6 w-6 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="mb-1.5 text-lg font-black text-gray-900">Free experience</h3>
        <p className="mb-4 text-sm leading-relaxed text-gray-500">
          Tickets are free for attendees. Perfect for community events, launches, and workshops.
        </p>
        <div className="mt-auto flex items-center gap-2">
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
            Activation fee from KES 1,000
          </span>
        </div>
        <div className="mt-4 flex items-center gap-1.5 font-semibold text-primary-600 group-hover:text-primary-700">
          Continue
          <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>
    </div>
  );
}
