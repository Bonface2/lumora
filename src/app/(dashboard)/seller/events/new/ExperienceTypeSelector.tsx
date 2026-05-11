"use client";

type ExperienceType = "PUBLIC" | "INVITE_ONLY" | "GROUP_TRIP";

interface Props {
  onSelect: (type: ExperienceType) => void;
}

const OPTIONS = [
  {
    type: "PUBLIC" as const,
    title: "Public event / tour",
    description:
      "Publicly listed on the events page. Anyone can discover and register. QR tickets issued to attendees.",
    badge: "Installments supported",
    badgeStyle: "bg-primary-50 text-primary-700 ring-1 ring-primary-200",
    icon: (
      <svg className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
      </svg>
    ),
    iconBg: "bg-primary-50",
  },
  {
    type: "INVITE_ONLY" as const,
    title: "Invite-only event",
    description:
      "Private — not listed publicly. Attendees access via direct link or email invite. You scan tickets on the day with a time-limited link.",
    badge: "Scan link provided",
    badgeStyle: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    icon: (
      <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
      </svg>
    ),
    iconBg: "bg-blue-50",
  },
  {
    type: "GROUP_TRIP" as const,
    title: "Private group trip",
    description:
      "Private booking for group trips or experiences. Perfect for tracking payments and installments. No ticket scanning needed.",
    badge: "Installments supported",
    badgeStyle: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    icon: (
      <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    iconBg: "bg-amber-50",
  },
];

export function ExperienceTypeSelector({ onSelect }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {OPTIONS.map((opt) => (
        <button
          key={opt.type}
          type="button"
          onClick={() => onSelect(opt.type)}
          className="group relative flex flex-col rounded-2xl border-2 border-gray-200 bg-white p-6 text-left transition-all hover:border-primary-500 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${opt.iconBg}`}>
            {opt.icon}
          </div>
          <h3 className="mb-1.5 text-base font-black text-gray-900">{opt.title}</h3>
          <p className="mb-4 text-sm leading-relaxed text-gray-500">{opt.description}</p>
          <div className="mt-auto flex items-center gap-2">
            {opt.badge && (
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${opt.badgeStyle}`}>
                {opt.badge}
              </span>
            )}
          </div>
          <div className="mt-4 flex items-center gap-1.5 font-semibold text-primary-600 group-hover:text-primary-700">
            Select
            <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>
      ))}
    </div>
  );
}
