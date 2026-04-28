import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    redirect(session.user.role === "SELLER" ? "/seller" : "/buyer");
  }

  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
        <span className="text-xl font-bold text-violet-600">Lumora</span>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-4 py-32 text-center">
        <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 sm:text-6xl">
          Events & Ticketing,{" "}
          <span className="text-violet-600">reimagined</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-gray-500">
          Buy tickets in full or spread the cost with installments. Sell your
          tickets on the resale market. Lumora keeps it simple.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/events"
            className="rounded-xl bg-violet-600 px-7 py-3 text-base font-semibold text-white shadow-sm hover:bg-violet-700"
          >
            Browse events
          </Link>
          <Link
            href="/register?role=seller"
            className="rounded-xl border border-gray-300 px-7 py-3 text-base font-semibold text-gray-700 hover:bg-gray-50"
          >
            Sell tickets
          </Link>
        </div>
      </section>

      {/* Feature strip */}
      <section className="border-t border-gray-100 bg-gray-50 px-8 py-16">
        <div className="mx-auto grid max-w-4xl gap-8 sm:grid-cols-3">
          {[
            {
              title: "Installment plans",
              body: "Pay a deposit today, spread the rest over time — all managed automatically.",
            },
            {
              title: "Resale market",
              body: "Can't make it? List your ticket for resale. Buyers inherit any remaining payments.",
            },
            {
              title: "Paystack payments",
              body: "Fast, secure card payments powered by Paystack — no sign-ups required at checkout.",
            },
          ].map((f) => (
            <div key={f.title}>
              <h3 className="font-semibold text-gray-900">{f.title}</h3>
              <p className="mt-2 text-sm text-gray-500">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
