import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/layouts/Footer";

export const metadata: Metadata = { title: "Privacy Policy" };

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

export default function PrivacyPage() {
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
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">Privacy Policy</h1>
          <p className="mt-3 text-sm text-gray-400">Last updated: {LAST_UPDATED}</p>
        </div>
      </section>

      {/* Intro strip */}
      <div className="border-b border-gray-200 bg-white px-6 py-6 md:px-10">
        <p className="mx-auto max-w-3xl text-sm leading-relaxed text-gray-600">
          At Lumora we take your privacy seriously. This Privacy Policy explains what information we collect, how we use it, and your rights regarding that information.
        </p>
      </div>

      {/* Sections */}
      <div className="mx-auto max-w-3xl space-y-4 px-6 py-12 md:px-10">

        <Section number="01" title="Who We Are">
          <p>
            Lumora is an online event ticketing and experience platform. For the purposes of data protection law, Lumora is the data controller of personal information collected through this Platform. You can contact us at{" "}
            <a href="mailto:hello@lumora.co" className="font-medium text-primary-600 hover:underline">hello@lumora.co</a>.
          </p>
        </Section>

        <Section number="02" title="Information We Collect">
          <div>
            <p className="font-semibold text-gray-700">Information you provide directly</p>
            <ul className="mt-2 space-y-2">
              <Bullet><strong className="text-gray-800">Account information</strong> — name, email address, phone number, and password when you register.</Bullet>
              <Bullet><strong className="text-gray-800">Payment information</strong> — card details and mobile money numbers. These are processed directly by Paystack and are not stored on Lumora servers.</Bullet>
              <Bullet><strong className="text-gray-800">Event / listing information</strong> — event descriptions, images, pricing, and venue details provided by Sellers.</Bullet>
              <Bullet><strong className="text-gray-800">Communications</strong> — messages you send us via email or the contact form.</Bullet>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-gray-700">Information collected automatically</p>
            <ul className="mt-2 space-y-2">
              <Bullet><strong className="text-gray-800">Usage data</strong> — pages visited, links clicked, time spent, and features used.</Bullet>
              <Bullet><strong className="text-gray-800">Device data</strong> — IP address, browser type, operating system, and device identifiers.</Bullet>
              <Bullet><strong className="text-gray-800">Cookies</strong> — session cookies for authentication and preference cookies to remember your settings.</Bullet>
            </ul>
          </div>
        </Section>

        <Section number="03" title="How We Use Your Information">
          <ul className="space-y-2">
            <Bullet>To create and manage your account.</Bullet>
            <Bullet>To process ticket purchases and installment payments.</Bullet>
            <Bullet>To send transactional emails — booking confirmations, receipts, and installment reminders.</Bullet>
            <Bullet>To facilitate ticket transfers and resale transactions.</Bullet>
            <Bullet>To respond to support requests.</Bullet>
            <Bullet>To detect and prevent fraud and abuse.</Bullet>
            <Bullet>To improve the Platform through analytics and user research.</Bullet>
            <Bullet>To send marketing communications where you have opted in (you may opt out at any time).</Bullet>
          </ul>
        </Section>

        <Section number="04" title="Legal Basis for Processing">
          <p>We process your personal data on the following grounds:</p>
          <ul className="mt-1 space-y-2">
            <Bullet><strong className="text-gray-800">Contract performance</strong> — to provide ticketing, payment, and account services.</Bullet>
            <Bullet><strong className="text-gray-800">Legal obligation</strong> — to comply with applicable Kenyan law and financial regulations.</Bullet>
            <Bullet><strong className="text-gray-800">Legitimate interests</strong> — fraud prevention, security, and platform improvement.</Bullet>
            <Bullet><strong className="text-gray-800">Consent</strong> — for marketing emails and non-essential cookies.</Bullet>
          </ul>
        </Section>

        <Section number="05" title="Sharing Your Information">
          <p>We do not sell your personal data. We may share it with:</p>
          <ul className="mt-1 space-y-2">
            <Bullet><strong className="text-gray-800">Paystack</strong> — to process payments. Paystack's privacy policy governs data they handle.</Bullet>
            <Bullet><strong className="text-gray-800">Email service providers</strong> — to send transactional and marketing emails on our behalf.</Bullet>
            <Bullet><strong className="text-gray-800">Cloud infrastructure providers</strong> — for hosting and storage.</Bullet>
            <Bullet><strong className="text-gray-800">Event Sellers</strong> — your name and contact details are shared with the Seller for events you purchase tickets to, solely for event management purposes.</Bullet>
            <Bullet><strong className="text-gray-800">Law enforcement / regulators</strong> — where required by law or to protect the rights and safety of our users.</Bullet>
          </ul>
        </Section>

        <Section number="06" title="Data Retention">
          <p>We retain your personal data for as long as your account is active or as needed to provide services. Financial transaction records are retained for 7 years as required by Kenyan tax law. You may request deletion of your account data subject to these legal retention obligations.</p>
        </Section>

        <Section number="07" title="Cookies">
          <p>We use the following categories of cookies:</p>
          <ul className="mt-1 space-y-2">
            <Bullet><strong className="text-gray-800">Essential</strong> — required for login sessions and security. Cannot be disabled.</Bullet>
            <Bullet><strong className="text-gray-800">Functional</strong> — remember your preferences (e.g., language).</Bullet>
            <Bullet><strong className="text-gray-800">Analytics</strong> — help us understand how the Platform is used (e.g., page views). You can opt out.</Bullet>
          </ul>
        </Section>

        <Section number="08" title="Your Rights">
          <p>Subject to applicable law, you have the right to:</p>
          <ul className="mt-1 space-y-2">
            <Bullet><strong className="text-gray-800">Access</strong> — request a copy of the personal data we hold about you.</Bullet>
            <Bullet><strong className="text-gray-800">Correction</strong> — ask us to correct inaccurate data.</Bullet>
            <Bullet><strong className="text-gray-800">Deletion</strong> — request erasure of your data, subject to legal retention requirements.</Bullet>
            <Bullet><strong className="text-gray-800">Objection</strong> — object to processing based on legitimate interests.</Bullet>
            <Bullet><strong className="text-gray-800">Data portability</strong> — receive your data in a structured, machine-readable format.</Bullet>
          </ul>
          <p className="mt-1">
            To exercise any of these rights, email{" "}
            <a href="mailto:hello@lumora.co" className="font-medium text-primary-600 hover:underline">hello@lumora.co</a>.
            {" "}We will respond within 30 days.
          </p>
        </Section>

        <Section number="09" title="Security">
          <p>We implement industry-standard security measures including HTTPS encryption, hashed passwords, and restricted access controls. However, no online service is 100% secure and we cannot guarantee absolute security.</p>
        </Section>

        <Section number="10" title="Children">
          <p>Lumora is not directed at children under 18. We do not knowingly collect personal data from minors. If you believe a child has provided us with their data, please contact us immediately.</p>
        </Section>

        <Section number="11" title="Changes to This Policy">
          <p>We may update this Privacy Policy periodically. We will notify registered users of material changes by email. Continued use of the Platform after changes are posted constitutes acceptance.</p>
        </Section>

        <Section number="12" title="Contact Us">
          <p>
            For privacy enquiries, contact us at{" "}
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
