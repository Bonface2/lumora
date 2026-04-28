import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: {
    default: "Lumora — Events & Ticketing",
    template: "%s | Lumora",
  },
  description:
    "Discover and buy tickets for the best events. Flexible installment payments available.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased"><Providers>{children}</Providers></body>
    </html>
  );
}
