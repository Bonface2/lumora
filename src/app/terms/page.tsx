import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/layouts/Footer";

export const metadata: Metadata = { title: "Terms of Service" };

const LAST_UPDATED = "1 May 2025";

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm md:p-8">
      <div className="flex items-start gap-4">
        <span className="flex-shrink-0 rounded-lg bg-primary-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-primary-600">
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black tracking-tight text-gray-900">{title}</h2>
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-gray-600">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary-400" />
      <span>{children}</span>
    </li>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Nav */}
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-gray-100 bg-white/95 backdrop-blur-sm px-6 py-4 md:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="Lumora" className="h-8 w-8 rounded-lg object-cover" />
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
        <div className="relative mx-auto max-w-3xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary-400">Legal</p>
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">Terms of Service</h1>
          <p className="mt-3 text-sm text-gray-400">Last updated: {LAST_UPDATED}</p>
        </div>
      </section>

      {/* Intro strip */}
      <div className="border-b border-gray-200 bg-white px-6 py-6 md:px-10">
        <p className="mx-auto max-w-3xl text-sm leading-relaxed text-gray-600">
          Welcome to Lumora. By accessing or using our platform you agree to be bound by these Terms of Service. Please read them carefully. If you do not agree, do not use Lumora.
        </p>
      </div>

      {/* Sections */}
      <div className="mx-auto max-w-3xl space-y-4 px-6 py-12 md:px-10">

        <Section number="01" title="Definitions">
          <ul className="space-y-2">
            <Bullet><strong className="text-gray-800">"Platform"</strong> — the Lumora website and all associated services.</Bullet>
            <Bullet><strong className="text-gray-800">"Buyer"</strong> — any user who purchases or reserves a ticket on the Platform.</Bullet>
            <Bullet><strong className="text-gray-800">"Seller / Host"</strong> — any user who lists an event or experience on the Platform.</Bullet>
            <Bullet><strong className="text-gray-800">"Ticket"</strong> — a digital token granting admission to a specific event or experience.</Bullet>
            <Bullet><strong className="text-gray-800">"Installment Plan"</strong> — a payment schedule whereby the Buyer pays in multiple tranches.</Bullet>
          </ul>
        </Section>

        <Section number="02" title="Eligibility">
          <p>You must be at least 18 years old and capable of forming a binding contract to use Lumora. By registering, you represent that the information you provide is accurate and complete.</p>
        </Section>

        <Section number="03" title="Accounts">
          <p>You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. Notify us immediately at <a href="mailto:hello@lumora.co" className="font-medium text-primary-600 hover:underline">hello@lumora.co</a> if you suspect unauthorised access.</p>
        </Section>

        <Section number="04" title="Ticket Purchases">
          <p>All sales are between the Buyer and the Seller. Lumora acts as a technology intermediary and payment facilitator, not the organiser of any event. Lumora does not guarantee that an event will take place; event cancellations are the Seller's responsibility.</p>
          <ul className="mt-1 space-y-2">
            <Bullet>Tickets are confirmed only upon successful payment or first instalment.</Bullet>
            <Bullet>Prices are displayed in Kenyan Shillings (KES) unless otherwise stated.</Bullet>
            <Bullet>Lumora reserves the right to charge a service fee on each transaction.</Bullet>
          </ul>
        </Section>

        <Section number="05" title="Installment Plans">
          <p>Where a Seller has enabled installment payments for a ticket category, the following terms apply:</p>
          <ul className="mt-1 space-y-2">
            <Bullet>The Buyer agrees to pay each instalment by its stated due date.</Bullet>
            <Bullet>Reminder emails are sent automatically 3 days before each due date.</Bullet>
            <Bullet>If a payment is not received within <strong className="text-gray-800">7 days</strong> of its due date, the ticket reservation will be automatically cancelled.</Bullet>
            <Bullet><strong className="text-gray-800">All payments already made under an Installment Plan are non-refundable upon cancellation due to default.</strong></Bullet>
            <Bullet>Lumora is not liable for failed or delayed payment reminders caused by incorrect email addresses or spam filters.</Bullet>
          </ul>
        </Section>

        <Section number="06" title="Refunds & Cancellations">
          <ul className="space-y-2">
            <Bullet>Refund eligibility is determined by the individual Seller's refund policy, displayed on the event page.</Bullet>
            <Bullet>Installment deposits and partial payments are <strong className="text-gray-800">non-refundable</strong> in the event of Buyer default.</Bullet>
            <Bullet>If a Seller cancels an event, Buyers are entitled to a full refund of all amounts paid to date.</Bullet>
            <Bullet>Refunds, where approved, are processed to the original payment method within 5–10 business days.</Bullet>
          </ul>
        </Section>

        <Section number="07" title="Reseller Marketplace">
          <ul className="space-y-2">
            <Bullet>Tickets purchased on Lumora may be listed for resale through the Lumora Reseller Marketplace.</Bullet>
            <Bullet>Each ticket may only be listed for resale once. Duplicate listings are strictly prohibited and will result in immediate account suspension.</Bullet>
            <Bullet>The resale price may not exceed <strong className="text-gray-800">150% of the original face value</strong> unless the Seller has explicitly permitted otherwise.</Bullet>
            <Bullet>Once a resale transfer is completed, ownership of the ticket passes irrevocably to the new Buyer.</Bullet>
            <Bullet>Lumora is not responsible for fraudulent or unauthorised resale listings made with stolen account credentials.</Bullet>
          </ul>
        </Section>

        <Section number="08" title="Seller Obligations">
          <p>By listing an event on Lumora, Sellers agree to:</p>
          <ul className="mt-1 space-y-2">
            <Bullet>Provide accurate, complete, and lawful event information.</Bullet>
            <Bullet>Honour all tickets sold through the Platform.</Bullet>
            <Bullet>Process refunds promptly in the event of cancellation.</Bullet>
            <Bullet>Comply with all applicable Kenyan laws, including those governing public gatherings and entertainment.</Bullet>
          </ul>
        </Section>

        <Section number="09" title="Payments & Payouts">
          <p>Payment processing is handled by <strong className="text-gray-800">Paystack</strong>. By using the Platform you agree to Paystack's terms of service. Seller payouts are processed after event completion, subject to any applicable holds for disputes or chargebacks. Lumora reserves the right to withhold payouts pending resolution of a dispute.</p>
        </Section>

        <Section number="10" title="Prohibited Conduct">
          <p>You may not:</p>
          <ul className="mt-1 space-y-2">
            <Bullet>List or purchase tickets for fraudulent, illegal, or non-existent events.</Bullet>
            <Bullet>Circumvent the Platform's ticket-transfer mechanisms to duplicate or counterfeit tickets.</Bullet>
            <Bullet>Use automated tools to scrape, bulk-purchase, or manipulate listings.</Bullet>
            <Bullet>Harass, defame, or harm other users.</Bullet>
          </ul>
          <p className="mt-1">Violation of these prohibitions may result in immediate account termination and, where applicable, referral to law enforcement.</p>
        </Section>

        <Section number="11" title="Intellectual Property">
          <p>All content on the Platform — including the Lumora name, logo, and design — is owned by or licensed to Lumora. You may not copy, reproduce, or distribute any part of the Platform without prior written consent.</p>
        </Section>

        <Section number="12" title="Limitation of Liability">
          <p>To the maximum extent permitted by applicable law, Lumora is not liable for any indirect, incidental, or consequential damages arising from your use of the Platform, including but not limited to losses arising from event cancellations, payment failures, or data breaches beyond our reasonable control.</p>
        </Section>

        <Section number="13" title="Governing Law">
          <p>These Terms are governed by the laws of the Republic of Kenya. Any disputes shall be subject to the exclusive jurisdiction of the courts of Nairobi, Kenya.</p>
        </Section>

        <Section number="14" title="Changes to These Terms">
          <p>We may update these Terms from time to time. Continued use of the Platform after changes are posted constitutes acceptance of the revised Terms. We will notify registered users of material changes by email.</p>
        </Section>

        <Section number="15" title="Contact">
          <p>
            Questions about these Terms? Reach us at{" "}
            <a href="mailto:hello@lumora.co" className="font-medium text-primary-600 hover:underline">hello@lumora.co</a>{" "}
            or visit our{" "}
            <Link href="/contact" className="font-medium text-primary-600 hover:underline">Contact page</Link>.
          </p>
        </Section>

      </div>

      <Footer />
    </div>
  );
}
