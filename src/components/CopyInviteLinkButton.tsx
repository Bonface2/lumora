"use client";

import { useState } from "react";
import { generatePrivateInviteLink } from "@/app/actions/events";

export function CopyInviteLinkButton({ eventId }: { eventId: string }) {
  const [step, setStep] = useState<"idle" | "pick" | "copied">("idle");
  const [maxUses, setMaxUses] = useState(1);
  const [rawInput, setRawInput] = useState("1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUrl, setLastUrl] = useState("");
  const [lastMax, setLastMax] = useState(0);

  async function handleGenerate() {
    setLoading(true);
    setError("");
    const res = await generatePrivateInviteLink(eventId, maxUses);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await navigator.clipboard.writeText(res.data.url);
    setLastUrl(res.data.url);
    setLastMax(res.data.maxUses);
    setStep("copied");
  }

  if (step === "copied") {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-xs font-bold text-emerald-700">Link generated and copied to clipboard</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2">
            <span className="flex-1 truncate font-mono text-xs text-gray-700">{lastUrl}</span>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(lastUrl)}
              className="shrink-0 rounded-md bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-200 transition-colors"
            >
              Copy
            </button>
          </div>
          <p className="text-xs text-amber-700 font-medium">
            ⚠ This link can be used by up to <strong>{lastMax}</strong> {lastMax === 1 ? "person" : "people"}. Once that limit is reached it expires automatically.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setStep("pick"); setRawInput("1"); setMaxUses(1); }}
              className="text-xs font-semibold text-primary-600 hover:text-primary-700"
            >
              Generate a new link
            </button>
            <span className="text-gray-300">·</span>
            <button
              type="button"
              onClick={() => setStep("idle")}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "pick") {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              How many people are you inviting with this link?
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={100}
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                onBlur={() => {
                  const clamped = Math.max(1, Math.min(100, parseInt(rawInput) || 1));
                  setMaxUses(clamped);
                  setRawInput(String(clamped));
                }}
                className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <span className="text-xs text-gray-500">
                {maxUses === 1 ? "person (single-use)" : `people (expires after ${maxUses} purchases)`}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            The link will expire once this many tickets are purchased through it. Share a fresh link for each additional batch of guests.
          </p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={handleGenerate}
              className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-xs font-bold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {loading ? "Generating…" : "Generate & copy link"}
            </button>
            <button
              type="button"
              onClick={() => { setStep("idle"); setError(""); }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setStep("pick")}
      className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 transition-colors w-full"
    >
      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
      Generate invite link
    </button>
  );
}
