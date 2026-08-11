"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Label } from "@/components/ui/Label";
import { resetPassword } from "@/app/actions/auth";

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <>
        <h1 className="mb-1 text-2xl font-bold text-gray-900">Invalid link</h1>
        <p className="mb-6 text-sm text-gray-500">
          This reset link is missing or malformed.{" "}
          <Link href="/forgot-password" className="font-medium text-primary-600 hover:underline">
            Request a new one.
          </Link>
        </p>
      </>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setLoading(true);
    setError("");
    const res = await resetPassword(token, password);
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    setDone(true);
    setTimeout(() => router.push("/login"), 2500);
  }

  if (done) {
    return (
      <>
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="mb-1 text-2xl font-bold text-gray-900">Password updated</h1>
        <p className="text-sm text-gray-500">
          Your password has been changed. Redirecting you to sign in…
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold text-gray-900">Set a new password</h1>
      <p className="mb-6 text-sm text-gray-500">Choose a strong password of at least 8 characters.</p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="password" required>New password</Label>
          <PasswordInput
            id="password"
            placeholder="••••••••"
            autoComplete="new-password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
          />
        </div>

        <div>
          <Label htmlFor="confirm" required>Confirm password</Label>
          <PasswordInput
            id="confirm"
            placeholder="••••••••"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setError(""); }}
          />
        </div>

        <Button type="submit" className="w-full" size="lg" loading={loading}>
          Update password
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <Card>
        <CardBody className="p-8">
          <ResetForm />
        </CardBody>
      </Card>
    </Suspense>
  );
}
