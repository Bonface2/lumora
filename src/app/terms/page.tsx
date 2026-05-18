import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/layouts/Footer";
import { getPlatformConfig } from "@/lib/platformConfig";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Terms of Service" };

const LAST_UPDATED = "11 May 2026";

function Section({
  number,
  id,
  title,
  children,
}: {
  number: string;
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-20 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm md:p-8">
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

function SubBullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gray-400" />
      <span>{children}</span>
    </li>
  );
}

export default async function TermsPage() {
  const { groupTripAutoApproveCap: cap } = await getPlatformConfig();

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
            <Bullet><strong className="text-gray-800">"Experience Type"</strong> — the category selected by a Seller when creating a listing, determining access rules and applicable terms. See Section 09.</Bullet>
            <Bullet><strong className="text-gray-800">"Group Trip"</strong> — a private, cost-sharing social experience organised for a pre-defined group of people who know each other personally. Subject to the specific rules in Section 10.</Bullet>
          </ul>
        </Section>

        <Section number="02" title="Eligibility">
          <p>You must be at least 18 years old and capable of forming a binding contract to use Lumora. By registering, you represent that the information you provide is accurate and complete.</p>
        </Section>

        <Section number="03" title="Accounts">
          <p>You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. Notify us immediately at <a href="mailto:support@lumora.co.ke" className="font-medium text-primary-600 hover:underline">support@lumora.co.ke</a> if you suspect unauthorised access.</p>
        </Section>

        <Section number="04" title="Ticket Purchases">
          <p>All sales are between the Buyer and the Seller. Lumora acts as a technology intermediary and payment facilitator, not the organiser of any event. Lumora does not guarantee that an event will take place; event cancellations are the Seller's responsibility.</p>
          <ul className="mt-1 space-y-2">
            <Bullet>Tickets are confirmed only upon successful payment or first installment.</Bullet>
            <Bullet>Prices are displayed in Kenyan Shillings (KES) unless otherwise stated.</Bullet>
            <Bullet>Lumora reserves the right to charge a service fee on each transaction.</Bullet>
          </ul>
        </Section>

        <div id="05" className="scroll-mt-20">
        <Section number="05" title="Installment Plans">
          <p>Where a Seller has enabled installment payments for a ticket category, the following terms apply:</p>
          <ul className="mt-1 space-y-2">
            <Bullet>The Buyer agrees to pay each installment by its stated due date.</Bullet>
            <Bullet>Reminder emails are sent automatically starting the day after a missed due date and each day thereafter until revocation.</Bullet>
            <Bullet>
              A ticket will be automatically revoked at whichever of the following occurs <strong className="text-gray-800">first</strong>:
              <ul className="mt-1.5 ml-4 space-y-1">
                <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gray-400" /><span>The Seller's grace period (set per ticket category) expires after the missed due date; <strong className="text-gray-800">or</strong></span></li>
                <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gray-400" /><span><strong className="text-gray-800">3 days before the event</strong>, unless an override applies (see below).</span></li>
              </ul>
            </Bullet>
            <Bullet><strong className="text-gray-800">All payments already made under an Installment Plan are non-refundable upon cancellation due to default.</strong></Bullet>
            <Bullet>Lumora is not liable for failed or delayed payment reminders caused by incorrect email addresses or spam filters.</Bullet>
          </ul>
          <p className="mt-3 font-semibold text-gray-800">Grace period hard cap</p>
          <ul className="mt-1 space-y-2">
            <Bullet>
              A grace period <strong className="text-gray-800">cannot extend beyond the event date itself</strong>. When configuring a ticket category, the Platform will reject any grace period that would expire after the event. The maximum permitted grace period is determined by the gap between the final installment due date and the event date.
            </Bullet>
          </ul>
          <p className="mt-3 font-semibold text-gray-800">Why the 3-day cutoff exists</p>
          <ul className="mt-1 space-y-2">
            <Bullet>
              The 3-day-before-event cutoff is designed to give the Platform enough time to make the
              freed slot available for purchase by another attendee. Lumora recommends that Sellers
              adopt this default behaviour wherever possible so that revoked tickets can be resold
              before the event.
            </Bullet>
          </ul>
          <p className="mt-3 font-semibold text-gray-800">3-days-before-event rule and overrides</p>
          <ul className="mt-1 space-y-2">
            <Bullet>
              <strong className="text-gray-800">Automatic bypass.</strong> If a Buyer&apos;s installment due date falls within 3 days of the event (or on the event day itself), the 3-day cutoff rule is automatically waived for that installment. Revocation will then be triggered solely by the grace period expiry, not by the 3-day cutoff.
            </Bullet>
            <Bullet>
              <strong className="text-gray-800">Seller opt-in override.</strong> If the grace period for a ticket category would extend past the 3-days-before-event threshold, the Platform alerts the Seller during setup. The Seller may choose to override the 3-day rule, in which case revocation will follow the full grace period timeline rather than the 3-day cutoff. This override applies to all Buyers in that ticket category.
            </Bullet>
            <Bullet>
              Where no override has been elected, the 3-day cutoff remains in effect and tickets with outstanding payments will be revoked at that point even if the grace period has not yet fully elapsed.
            </Bullet>
          </ul>
          <p className="mt-3 font-semibold text-gray-800">Grace period extensions</p>
          <ul className="mt-1 space-y-2">
            <Bullet>
              Where a Seller has enabled automatic revocation, they may extend the grace period for an individual Buyer at any point before revocation occurs. Extensions are applied from the Seller&apos;s event dashboard on a per-order basis.
            </Bullet>
            <Bullet>
              An extension only affects that specific Buyer&apos;s order. It does not alter the default grace period configured for the ticket category or for any other Buyer.
            </Bullet>
            <Bullet>
              Extensions reschedule the automatic revocation deadline. The revised deadline is calculated as: <strong className="text-gray-800">original due date + plan grace period + total extension days</strong>, subject to the hard event-date cap and, where no override is active, the 3-days-before-event cutoff.
            </Bullet>
          </ul>
          <p className="mt-3 font-semibold text-gray-800">Manual revocation mode</p>
          <ul className="mt-1 space-y-2">
            <Bullet>
              Sellers may disable automatic revocation for a ticket category. In this mode, no ticket is revoked automatically — the Seller is solely responsible for monitoring missed payments and revoking tickets manually from their dashboard.
            </Bullet>
            <Bullet>
              Grace period extensions are not applicable when automatic revocation is disabled, as there is no scheduled revocation to reschedule.
            </Bullet>
            <Bullet>
              Lumora bears no liability for Sellers failing to act on missed payments in manual revocation mode.
            </Bullet>
          </ul>
          <p className="mt-3 font-semibold text-gray-800">Ticket reinstatement</p>
          <ul className="mt-1 space-y-2">
            <Bullet>
              A revoked ticket may be <strong className="text-gray-800">reinstated</strong> by the event organiser or by a Lumora administrator — for example, following successful dispute resolution or a payment arrangement reached outside the Platform.
            </Bullet>
            <Bullet>
              Reinstatement restores the ticket to <strong className="text-gray-800">Active</strong> status. Where the order was settled in full at the time of revocation, its status is restored to Paid in Full; where installments were still outstanding, the order reverts to Partially Paid and any previously defaulted installment payments are restored to Overdue status, meaning they remain due.
            </Bullet>
            <Bullet>
              The Buyer will receive an email notification when their ticket is reinstated. It is the Buyer&apos;s responsibility to ensure they meet any outstanding payment obligations following reinstatement.
            </Bullet>
            <Bullet>
              Reinstatement is at the sole discretion of the event organiser or Lumora. Neither party is obligated to reinstate a revoked ticket.
            </Bullet>
          </ul>
        </Section>
        </div>

        <div id="06" className="scroll-mt-20">
        <Section number="06" title="Ticket & Payment Schedule Transfers">
          <p>
            Buyers may transfer ownership of a ticket — or an active installment payment schedule — to another person using the Lumora transfer feature. The following conditions apply:
          </p>
          <ul className="mt-1 space-y-2">
            <Bullet>
              <strong className="text-gray-800">How it works.</strong> The current ticket holder initiates a transfer from their buyer dashboard by entering the recipient&apos;s email address. Lumora sends the recipient an invitation link. The recipient must accept or decline within <strong className="text-gray-800">24 hours</strong>; if no action is taken the invitation expires automatically.
            </Bullet>
            <Bullet>
              <strong className="text-gray-800">Unregistered recipients.</strong> If the recipient does not yet have a Lumora account, they will be prompted to register before accepting. The invitation link remains valid for the 24-hour window.
            </Bullet>
            <Bullet>
              <strong className="text-gray-800">Effect of acceptance.</strong> Upon acceptance, full ownership — including the ticket, any remaining installment obligations, and associated payment history — transfers to the recipient. The original Buyer is relieved of all future payment obligations for that order.
            </Bullet>
            <Bullet>
              <strong className="text-gray-800">Effect of decline or expiry.</strong> If the recipient declines or the invitation expires, ownership remains with the original Buyer and all installment obligations continue unchanged.
            </Bullet>
            <Bullet>
              <strong className="text-gray-800">Installment responsibility.</strong> The recipient who accepts a transfer of a payment schedule assumes full liability for all outstanding installments from the date of transfer. Missed payments after transfer are subject to the same grace period and revocation rules as set out in Section 05.
            </Bullet>
            <Bullet>
              <strong className="text-gray-800">Defaulted installments on transfer.</strong> If any installment payments on the order are in <em>defaulted</em> status at the time of transfer, the recipient must pay the full outstanding defaulted amount immediately upon accepting the transfer. The Platform will present a payment screen before completing the ownership change. The recipient will be clearly informed of the amount due before accepting. Subsequent installments on the original schedule continue normally after the defaulted amount is cleared.
            </Bullet>
            <Bullet>
              <strong className="text-gray-800">One pending transfer at a time.</strong> Only one transfer invitation may be active per order at any given time. The sender may cancel a pending invitation before it is accepted.
            </Bullet>
            <Bullet>
              <strong className="text-gray-800">Non-transferable orders.</strong> Transfers are not permitted for orders with status Revoked, Cancelled, or Defaulted.
            </Bullet>
            <Bullet>
              Lumora is not responsible for transfers made in error. Completed transfers are final and cannot be reversed through the Platform.
            </Bullet>
          </ul>
        </Section>
        </div>

        <Section number="07" title="Refunds & Cancellations">
          <ul className="space-y-2">
            <Bullet>Refund eligibility is determined by the individual Seller's refund policy, displayed on the event page.</Bullet>
            <Bullet>Installment deposits and partial payments are <strong className="text-gray-800">non-refundable</strong> in the event of Buyer default.</Bullet>
            <Bullet>If a Seller cancels a published event, Buyers are entitled to a full refund of all amounts paid to date.</Bullet>
            <Bullet>Refunds, where approved, are processed to the original payment method within 5–10 business days.</Bullet>
            <Bullet>
              <strong className="text-gray-800">Seller cancellation of a published event:</strong> when a Seller cancels an event for which participant payments have been collected, the total amount collected — less any accrued Lumora platform fees — will be disbursed to the Seller&apos;s registered payout account within 5–10 business days. Lumora will notify the Seller by email once the disbursement has been processed.
            </Bullet>
          </ul>
        </Section>

        <Section number="08" title="Seller Obligations">
          <p>By listing an event on Lumora, Sellers agree to:</p>
          <ul className="mt-1 space-y-2">
            <Bullet>Provide accurate, complete, and lawful event information.</Bullet>
            <Bullet>Honour all tickets sold through the Platform.</Bullet>
            <Bullet>Process refunds promptly in the event of cancellation.</Bullet>
            <Bullet>Comply with all applicable Kenyan laws, including those governing public gatherings and entertainment.</Bullet>
            <Bullet>Select the correct Experience Type for their listing and abide by all associated terms.</Bullet>
          </ul>
        </Section>

        <Section number="09" id="09" title="Experience Types">
          <p>
            Lumora supports three experience types, each designed for a different kind of event. By selecting an experience type, the Seller confirms they understand and accept the terms specific to that type.
          </p>

          <p className="mt-3 font-semibold text-gray-800">Public Event</p>
          <p>
            A publicly listed event open to anyone on the Lumora marketplace. Public Events are discoverable by all visitors and any registered user may purchase a ticket.
          </p>
          <ul className="mt-1 space-y-2">
            <Bullet>Suitable for concerts, workshops, community events, fundraisers, and any gathering open to the general public.</Bullet>
            <Bullet>Paid Public Events are subject to a percentage-based platform fee on each ticket sold.</Bullet>
            <Bullet>The Seller is responsible for ensuring the event complies with all applicable laws governing public gatherings in Kenya.</Bullet>
          </ul>

          <p className="mt-3 font-semibold text-gray-800">Invite-Only Event</p>
          <p>
            A private event not listed publicly. Access is granted only via an invitation link or direct email invite sent by the organiser. Invite-Only events do not appear in Lumora search or browse pages.
          </p>
          <ul className="mt-1 space-y-2">
            <Bullet>Suitable for private gatherings, corporate functions, exclusive workshops, or any event where the organiser curates the guest list.</Bullet>
            <Bullet>Paid Invite-Only Events are subject to a percentage-based platform fee on each ticket sold.</Bullet>
            <Bullet>The organiser is responsible for ensuring that invitation links are shared only with intended guests.</Bullet>
          </ul>

          <p className="mt-3 font-semibold text-gray-800">Group Trip</p>
          <p>
            A private, cost-sharing social experience organised for a pre-defined group of people who know each other personally — such as friends, family, or a community group — where the purpose is to share the cost of a trip rather than to generate commercial profit.
          </p>
          <ul className="mt-1 space-y-2">
            <Bullet>Group Trips are <strong className="text-gray-800">always private</strong>. They are never publicly listed or discoverable on the marketplace.</Bullet>
            <Bullet>Group Trips are subject to a flat platform fee rather than a percentage-based fee, reflecting their non-commercial nature.</Bullet>
            <Bullet>
              Group Trips are subject to <strong className="text-gray-800">additional specific rules</strong> set out in full in Section 10. These rules exist to prevent misuse of the reduced fee structure by commercial tour operators and travel businesses.
            </Bullet>
            <Bullet>By selecting the Group Trip experience type, the organiser makes a binding legal declaration that the trip qualifies under Section 10.</Bullet>
          </ul>
        </Section>

        <Section number="10" id="10" title="Group Trip Policy">
          <p className="font-semibold text-gray-800">Purpose and scope</p>
          <p>
            The Group Trip experience type is reserved exclusively for genuine social group travel — trips organised among people who know each other personally, where participants share costs for a shared experience. It is <strong className="text-gray-800">not</strong> available to businesses, tour operators, travel agencies, safari companies, or any individual or entity using the Platform as a channel to sell commercial travel services.
          </p>

          <p className="mt-4 font-semibold text-gray-800">Eligibility rules</p>
          <ul className="mt-1 space-y-2">
            <Bullet>
              <strong className="text-gray-800">Personal social use only.</strong> Group Trips may only be created to organise travel among a defined group of people who know each other — for example, friends, family members, colleagues travelling together, or members of a social community. Cost-sharing among such a group is permitted.
            </Bullet>
            <Bullet>
              <strong className="text-gray-800">No commercial tourism.</strong> Creating a Group Trip listing to sell tour packages, safari experiences, travel itineraries, or any other commercial travel product — regardless of the price or the number of participants — is strictly prohibited and constitutes a material breach of these Terms.
            </Bullet>
            <Bullet>
              <strong className="text-gray-800">Organiser declaration.</strong> When creating a Group Trip, the organiser must confirm by checkbox that the trip is a genuine social group trip and that they are not running a commercial tour or travel business. This declaration constitutes a binding legal representation. Providing a false declaration is a serious breach of these Terms and may expose the organiser to civil and criminal liability.
            </Bullet>
          </ul>

          <p className="mt-4 font-semibold text-gray-800">Capacity and review</p>
          <ul className="mt-1 space-y-2">
            <Bullet>
              <strong className="text-gray-800">Auto-approve cap.</strong> Group Trips with a declared guest count of <strong className="text-gray-800">{cap} or fewer</strong> are automatically approved and proceed to Draft status immediately.
            </Bullet>
            <Bullet>
              <strong className="text-gray-800">Admin review for larger groups.</strong> Group Trips with a declared guest count <strong className="text-gray-800">above {cap}</strong> require Lumora review before the event may be published. Lumora will review the trip and notify the organiser by email once a decision has been made. Lumora reserves the right to decline any listing that does not meet the criteria for a genuine social group trip.
            </Bullet>
            <Bullet>
              <strong className="text-gray-800">Capacity enforcement.</strong> The total number of tickets created for a Group Trip may not exceed the organiser's declared guest count.
            </Bullet>
          </ul>

          <p className="mt-4 font-semibold text-gray-800">Capacity expansion</p>
          <ul className="mt-1 space-y-2">
            <Bullet>
              Once a Group Trip is published, the organiser may submit <strong className="text-gray-800">one capacity expansion request per event</strong>. No further expansion requests will be accepted after the first has been submitted, whether approved or declined.
            </Bullet>
            <Bullet>
              An expansion request must include: the number of additional participants requested, a written reason for the expansion, and the full contact details (name, email address, and phone number) of each additional participant.
            </Bullet>
            <Bullet>
              Lumora will review expansion requests and notify the organiser by email. Approval is at Lumora&apos;s sole discretion.
            </Bullet>
            <Bullet>
              <strong className="text-gray-800">No circumvention.</strong> Creating multiple Group Trip listings for the same commercial activity in order to stay under the capacity cap or avoid review is prohibited and constitutes a breach of these Terms.
            </Bullet>
          </ul>

          <p className="mt-4 font-semibold text-gray-800">Enforcement and consequences</p>
          <p>
            Lumora takes misuse of the Group Trip experience type seriously. Any organiser found to be using this feature for commercial touring, travel sales, or any other prohibited purpose — including by making a false declaration at the time of creation — will be subject to all of the following:
          </p>
          <ul className="mt-2 space-y-2">
            <Bullet>Immediate suspension or permanent termination of their Lumora account;</Bullet>
            <Bullet>Forfeiture of any pending or future payouts related to the affected event(s);</Bullet>
            <Bullet>Recovery by Lumora of the difference between the flat fee charged and the percentage fee that would have applied had the correct experience type been selected;</Bullet>
            <Bullet>Reporting to the relevant Kenyan authorities, including the <strong className="text-gray-800">Kenya Revenue Authority (KRA)</strong> and law enforcement agencies, where the conduct constitutes fraud, tax evasion, or any other criminal offence under Kenyan law.</Bullet>
          </ul>
          <p className="mt-3">
            Lumora reserves the right to pursue civil and criminal remedies against any party found to have misused the Platform, including claims for damages, legal costs, and any amounts improperly obtained through misrepresentation.
          </p>
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="font-semibold text-red-800">Legal warning</p>
            <p className="mt-1 text-red-700">
              Misrepresenting a commercial operation as a personal group trip may constitute:
            </p>
            <ul className="mt-2 space-y-1.5">
              <SubBullet><strong className="text-red-800">Fraud</strong> under the Kenyan Penal Code (Cap. 63), which is a criminal offence carrying a custodial sentence;</SubBullet>
              <SubBullet><strong className="text-red-800">Tax evasion or underdeclaration of income</strong> under the Tax Procedures Act, 2015 and the Income Tax Act (Cap. 470), attracting penalties and prosecution by the KRA;</SubBullet>
              <SubBullet><strong className="text-red-800">Breach of contract</strong> giving rise to civil liability for damages.</SubBullet>
            </ul>
            <p className="mt-3 text-red-700">
              Lumora will cooperate fully with any investigation by relevant authorities and will provide transaction records, user information, and any other data as required by law or court order.
            </p>
          </div>
        </Section>

        <Section number="11" title="Payments & Payouts">
          <p>Payment processing is handled by <strong className="text-gray-800">Paystack</strong>. By using the Platform you agree to Paystack's terms of service. Seller payouts are processed after event completion, subject to any applicable holds for disputes or chargebacks. Lumora reserves the right to withhold payouts pending resolution of a dispute.</p>
        </Section>

        <Section number="12" title="Prohibited Conduct">
          <p>You may not:</p>
          <ul className="mt-1 space-y-2">
            <Bullet>List or purchase tickets for fraudulent, illegal, or non-existent events.</Bullet>
            <Bullet>Select an experience type that does not accurately describe your event in order to obtain a reduced platform fee or bypass review requirements.</Bullet>
            <Bullet>Circumvent the Platform's ticket-transfer mechanisms to duplicate or counterfeit tickets.</Bullet>
            <Bullet>Use automated tools to scrape, bulk-purchase, or manipulate listings.</Bullet>
            <Bullet>Harass, defame, or harm other users.</Bullet>
          </ul>
          <p className="mt-1">Violation of these prohibitions may result in immediate account termination and, where applicable, referral to law enforcement.</p>
        </Section>

        <Section number="13" title="Intellectual Property">
          <p>All content on the Platform — including the Lumora name, logo, and design — is owned by or licensed to Lumora. You may not copy, reproduce, or distribute any part of the Platform without prior written consent.</p>
        </Section>

        <Section number="14" title="Limitation of Liability">
          <p>To the maximum extent permitted by applicable law, Lumora is not liable for any indirect, incidental, or consequential damages arising from your use of the Platform, including but not limited to losses arising from event cancellations, payment failures, or data breaches beyond our reasonable control.</p>
        </Section>

        <Section number="15" title="Governing Law">
          <p>These Terms are governed by the laws of the Republic of Kenya. Any disputes shall be subject to the exclusive jurisdiction of the courts of Nairobi, Kenya.</p>
        </Section>

        <Section number="16" title="Changes to These Terms">
          <p>We may update these Terms from time to time. Continued use of the Platform after changes are posted constitutes acceptance of the revised Terms. We will notify registered users of material changes by email.</p>
        </Section>

        <Section number="17" title="Contact">
          <p>
            Questions about these Terms? Reach us at{" "}
            <a href="mailto:support@lumora.co.ke" className="font-medium text-primary-600 hover:underline">support@lumora.co.ke</a>{" "}
            or visit our{" "}
            <Link href="/contact" className="font-medium text-primary-600 hover:underline">Contact page</Link>.
          </p>
        </Section>

      </div>

      <Footer />
    </div>
  );
}
