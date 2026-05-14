import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/layouts/Footer";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = { title: "Contact Us" };

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white font-sans">
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

      {/* Hero banner */}
      <section className="bg-gray-950 px-6 py-14 md:px-10">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-widest text-primary-400 mb-3">Get in touch</p>
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">Contact Us</h1>
          <p className="mt-3 text-base text-gray-400">
            We&apos;re here to help — whether you&apos;re a buyer, host, or just curious.
          </p>
        </div>
      </section>

      {/* Contact cards + form */}
      <section className="mx-auto max-w-5xl px-6 py-16 md:px-10">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left — contact details */}
          <div className="space-y-6">
            <h2 className="text-2xl font-black tracking-tight text-gray-900">Reach us directly</h2>
            <p className="text-sm leading-relaxed text-gray-500">
              Our team typically responds within 1 business day. For urgent event-day issues, please call or WhatsApp us directly.
            </p>

            {/* Email */}
            <div className="flex items-start gap-4 rounded-2xl border border-gray-100 bg-primary-50 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Email</p>
                <a
                  href="mailto:support@lumora.co.ke"
                  className="mt-0.5 block text-base font-bold text-primary-600 hover:text-primary-700 transition-colors"
                >
                  support@lumora.co.ke
                </a>
                <p className="mt-1 text-xs text-gray-500">General enquiries &amp; support</p>
              </div>
            </div>

            {/* Phone */}
            <div className="flex items-start gap-4 rounded-2xl border border-gray-100 bg-primary-50 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Phone / WhatsApp</p>
                <a
                  href="tel:+254701536040"
                  className="mt-0.5 block text-base font-bold text-primary-600 hover:text-primary-700 transition-colors"
                >
                  +254 701 536 040
                </a>
                <p className="mt-1 text-xs text-gray-500">Mon – Fri, 9 am – 6 pm EAT</p>
              </div>
            </div>

            {/* Quick links */}
            <div className="rounded-2xl border border-gray-100 p-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-500">Quick links</p>
              <div className="space-y-2">
                {[
                  { label: "Read our Terms of Service", href: "/terms" },
                  { label: "Read our Privacy Policy", href: "/privacy" },
                  { label: "Explore upcoming events", href: "/events" },
                  { label: "List your experience", href: "/register?role=seller" },
                ].map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="flex items-center justify-between text-sm font-semibold text-gray-700 hover:text-primary-600 transition-colors"
                  >
                    {l.label}
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Right — contact form */}
          <ContactForm />
        </div>
      </section>

      <Footer />
    </div>
  );
}
