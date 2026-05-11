"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { requestPasswordReset } from "@/app/actions/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Enter your email address."); return; }
    setLoading(true);
    setError("");
    const res = await requestPasswordReset(email.trim());
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    setSent(true);
  }

  return (
    <Card>
      <CardBody className="p-8">
        {sent ? (
          <>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="mb-1 text-2xl font-bold text-gray-900">Check your email</h1>
            <p className="mb-6 text-sm text-gray-500">
              If an account exists for <strong>{email}</strong>, we&apos;ve sent a reset link. It expires in 1 hour.
            </p>
            <p className="text-center text-sm text-gray-500">
              <Link href="/login" className="font-medium text-primary-600 hover:underline">
                Back to sign in
              </Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="mb-1 text-2xl font-bold text-gray-900">Forgot your password?</h1>
            <p className="mb-6 text-sm text-gray-500">
              Enter your email and we&apos;ll send you a reset link.
            </p>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email" required>Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                />
              </div>

              <Button type="submit" className="w-full" size="lg" loading={loading}>
                Send reset link
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              Remembered it?{" "}
              <Link href="/login" className="font-medium text-primary-600 hover:underline">
                Sign in
              </Link>
            </p>
          </>
        )}
      </CardBody>
    </Card>
  );
}
