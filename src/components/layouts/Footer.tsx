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
        <div className="flex flex-col items-center gap-10 md:flex-row md:items-start md:justify-between">
          {/* Brand */}
          <div className="max-w-xs text-center md:text-left">
            <Link href="/" className="flex items-center justify-center md:justify-start">
              <img src="/logo.svg" alt="Lumora" className="h-10 w-auto object-contain" />
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-gray-400">
              Every experience worth having — buy tickets or spread the cost with installments.
            </p>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-y-6 text-center md:flex md:gap-16 md:text-left">
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
            <span className="font-semibold text-gray-400">IntaSend</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
