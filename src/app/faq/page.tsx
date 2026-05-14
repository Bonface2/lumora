import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/layouts/Footer";

export const metadata: Metadata = { title: "FAQ — Lumora" };

const CATEGORIES = [
  {
    label: "Buying Tickets",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
      </svg>
    ),
    items: [
      {
        q: "How do I buy a ticket?",
        a: "Browse experiences at Lumora, pick the one you want, choose a ticket category, and proceed to checkout. You can pay in full or — where the host has enabled it — spread the cost with an installment plan. You'll receive a confirmation email with your digital ticket once payment is confirmed.",
      },
      {
        q: "What payment methods are accepted?",
        a: "All payments are processed securely by Paystack. We accept major debit/credit cards (Visa, Mastercard) and mobile money options supported by Paystack in Kenya. Card details are never stored on Lumora's servers.",
      },
      {
        q: "How do I receive my ticket after purchase?",
        a: "Your ticket is delivered instantly to your registered email address as a confirmation with a unique QR code. You can also view and download all your tickets from your Buyer dashboard under My Tickets.",
      },
      {
        q: "Can I transfer a ticket to someone else?",
        a: "Yes. You can list your ticket on the Lumora Reseller Marketplace, where another buyer can purchase it from you. Direct peer-to-peer transfers outside the platform are not supported to protect both parties.",
      },
    ],
  },
  {
    label: "Installment Plans",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    items: [
      {
        q: "What is an installment plan?",
        a: "An installment plan lets you secure your ticket by paying a deposit upfront and spreading the remaining balance across scheduled payments before the event. Not all events offer this option — look for the 'Installments' badge on the event card.",
      },
      {
        q: "What happens if I miss an installment payment?",
        a: "We'll send you reminder emails 3 days before each due date. If a payment isn't received within 7 days of its due date, your ticket reservation is automatically cancelled. Payments already made under an installment plan are non-refundable upon cancellation due to default — so please keep your payment method up to date.",
      },
      {
        q: "Can I pay off my installment plan early?",
        a: "Yes. You can make early payments at any time from your Buyer dashboard. Paying early won't incur any additional charges.",
      },
      {
        q: "Will I still get my ticket if I'm on an installment plan?",
        a: "Your ticket is reserved as soon as the first installment is paid. You'll receive your final confirmed ticket (with QR code) once all installments are completed.",
      },
    ],
  },
  {
    label: "Refunds & Cancellations",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 2 2 2-2 2 2 2-2 4 2z" />
      </svg>
    ),
    items: [
      {
        q: "Can I get a refund?",
        a: "Refund eligibility depends on the individual event host's refund policy, which is displayed on the event page before you purchase. If no refund policy is stated, tickets are generally non-refundable. Installment deposits are non-refundable in the event of buyer default.",
      },
      {
        q: "What if the event is cancelled?",
        a: "If a Seller cancels an event, all Buyers are entitled to a full refund of every payment made for that event, including installments. Refunds are processed to the original payment method within 5–10 business days.",
      },
      {
        q: "How long do refunds take?",
        a: "Approved refunds are typically processed within 5–10 business days back to your original payment method. Timing can vary depending on your bank or card issuer.",
      },
    ],
  },
  {
    label: "Hosting an Event",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    items: [
      {
        q: "How do I list an event on Lumora?",
        a: "Register for a Seller account (or switch your existing account to Seller), then head to your Seller dashboard and click Create Event. Fill in the event details, add ticket categories and pricing, set your refund policy, and publish when you're ready.",
      },
      {
        q: "Can I offer installment plans for my event?",
        a: "Yes. When creating a ticket category, you can toggle the 'Allow installments' option and define the number of installments and amounts. Lumora handles all payment reminders and cancellations automatically.",
      },
      {
        q: "When do I receive my payout?",
        a: "Seller payouts are processed after the event has taken place, subject to a standard holding period for potential disputes or chargebacks. You can track your payout status in the Seller dashboard.",
      },
      {
        q: "What fees does Lumora charge hosts?",
        a: "Lumora charges a service fee per ticket sold, deducted at the time of payout. The fee structure is detailed in your Seller dashboard. There are no upfront listing fees.",
      },
    ],
  },
  {
    label: "Account & Security",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    items: [
      {
        q: "Is my payment information secure?",
        a: "Yes. All payment processing is handled by Paystack, a PCI-DSS compliant payment processor. Your card and mobile money details are never stored on Lumora's servers. All data is transmitted over HTTPS.",
      },
      {
        q: "I forgot my password. How do I reset it?",
        a: "On the login page, click 'Forgot password?' and enter your registered email. You'll receive a password reset link within a few minutes. If you don't see it, check your spam folder.",
      },
      {
        q: "Can I sign in with Google?",
        a: "Yes. You can create an account or sign in using your Google account for a faster experience. You'll need to agree to our Terms of Service and confirm you're 18 or over the first time you sign in.",
      },
      {
        q: "How do I delete my account?",
        a: "You can request account deletion from your account Settings page. For legal compliance, financial transaction records associated with your account are retained for 7 years as required by Kenyan law, even after deletion.",
      },
    ],
  },
];

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Nav */}
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-gray-100 bg-white/95 backdrop-blur-sm px-6 py-4 md:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/logo-light.svg" alt="Lumora" className="h-8 w-8 rounded-lg object-cover" />
          <span className="text-lg font-black tracking-tight text-gray-900">Lumora</span>
        </Link>
        <div className="hidden items-center gap-6 md:flex">
          <Link href="/events" className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors">Explore</Link>
          <Link href="/register?role=seller" className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors">List an experience</Link>
        </div>
        <Link href="/login" className="rounded-xl bg-primary-600 px-5 py-2 text-sm font-bold tracking-wide text-white hover:bg-primary-700 transition-colors">
          Log in
        </Link>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gray-950 px-6 py-14 md:px-10 md:py-20">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle, #16b5b8 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[600px] -translate-x-1/2 rounded-full bg-primary-500/20 blur-[100px]" />
        <div className="relative mx-auto max-w-3xl text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary-400">Support</p>
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
            Frequently asked questions
          </h1>
          <p className="mt-4 text-base text-gray-400">
            Everything you need to know about buying tickets, installments, and hosting events on Lumora.
          </p>
        </div>
      </section>

      {/* FAQ sections */}
      <div className="mx-auto max-w-3xl space-y-10 px-6 py-14 md:px-10">
        {CATEGORIES.map((category) => (
          <div key={category.label}>
            {/* Category heading */}
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary-600 text-white">
                {category.icon}
              </span>
              <h2 className="text-lg font-black tracking-tight text-gray-900">{category.label}</h2>
            </div>

            {/* Questions */}
            <div className="space-y-3">
              {category.items.map((item) => (
                <div
                  key={item.q}
                  className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
                >
                  <p className="font-bold text-gray-900">{item.q}</p>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Still need help CTA */}
        <div className="rounded-2xl bg-gray-950 px-8 py-10 text-center">
          <div className="pointer-events-none absolute inset-0 opacity-0" />
          <p className="text-xs font-bold uppercase tracking-widest text-primary-400">Still need help?</p>
          <h3 className="mt-2 text-2xl font-black tracking-tight text-white">We're here for you</h3>
          <p className="mt-2 text-sm text-gray-400">Can't find what you're looking for? Our support team is happy to help.</p>
          <Link
            href="/contact"
            className="mt-6 inline-block rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-primary-700 transition-colors"
          >
            Contact us
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
}
