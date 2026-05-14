import Link from "next/link";

const LINKS = [
  {
    heading: "Support",
    items: [
      { label: "Contact us", href: "/contact" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    heading: "Legal",
    items: [
      { label: "Terms of Service", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-gray-950 px-6 pt-14 pb-8 md:px-10">
      <div className="mx-auto max-w-6xl">
        {/* Top row */}
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          {/* Brand — anchored left */}
          <div className="max-w-xs">
            <Link href="/" className="flex items-center">
              <span className="text-2xl font-bold tracking-wide text-white" style={{ fontFamily: "var(--font-display)" }}>Lumora</span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-gray-400">
              Every experience worth having — buy tickets or spread the cost with installments.
            </p>
          </div>

          {/* Link columns — anchored right on desktop, left on mobile */}
          <div className="grid grid-cols-2 gap-y-6 md:flex md:gap-16">
            {LINKS.map((col) => (
              <div key={col.heading}>
                <p className="mb-4 text-xs font-bold uppercase tracking-widest text-primary-400">
                  {col.heading}
                </p>
                <ul className="space-y-2.5">
                  {col.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="text-sm text-gray-400 transition-colors hover:text-white"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="mt-12 border-t border-white/10 pt-6 flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} Lumora. All rights reserved.
          </p>
          <p className="text-xs text-gray-500">
            Payments powered by{" "}
            <span className="font-semibold text-gray-400">Paystack</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
