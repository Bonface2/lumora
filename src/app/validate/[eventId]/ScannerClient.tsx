"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface Props {
  eventId: string;
  eventTitle: string;
  initialCheckedIn: number;
  totalSold: number;
}

type ScanResult =
  | { status: "success"; ticketNumber: string; categoryName: string }
  | { status: "already_scanned"; ticketNumber: string; checkedInAt: string }
  | { status: "invalid"; reason: string };

export function ScannerClient({ eventId, eventTitle, initialCheckedIn, totalSold }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [checkedIn, setCheckedIn] = useState(initialCheckedIn);
  const [manualInput, setManualInput] = useState("");
  const [validating, setValidating] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showResult = (r: ScanResult) => {
    setResult(r);
    if (r.status === "success") setCheckedIn((n) => n + 1);
    // Auto-clear after 3s and resume scanning
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setResult(null), 3000);
  };

  const validate = useCallback(
    async (ticketNumber: string) => {
      if (validating) return;
      setValidating(true);
      try {
        const res = await fetch("/api/tickets/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticketNumber: ticketNumber.trim(), eventId }),
        });
        const data = await res.json();
        if (data.valid) {
          showResult({ status: "success", ticketNumber: data.ticketNumber, categoryName: data.categoryName });
        } else if (data.checkedInAt) {
          showResult({ status: "already_scanned", ticketNumber: ticketNumber.trim(), checkedInAt: data.checkedInAt });
        } else {
          showResult({ status: "invalid", reason: data.reason ?? "Invalid ticket" });
        }
      } catch {
        showResult({ status: "invalid", reason: "Network error — try again" });
      } finally {
        setValidating(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [eventId, validating]
  );

  useEffect(() => {
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (!validating && !result) validate(decodedText);
        },
        undefined
      )
      .then(() => setScanning(true))
      .catch(() => setScanning(false));

    return () => {
      clearTimeout(resetTimer.current ?? undefined);
      scanner.stop().catch(() => {});
    };
    // run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualInput.trim()) return;
    await validate(manualInput);
    setManualInput("");
  }

  const overlayColor =
    result?.status === "success"
      ? "bg-green-500"
      : result?.status === "already_scanned"
        ? "bg-amber-500"
        : result?.status === "invalid"
          ? "bg-red-500"
          : null;

  return (
    <div className="flex min-h-screen flex-col bg-gray-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div>
          <p className="text-xs text-gray-400">Scanning for</p>
          <p className="font-semibold text-sm truncate max-w-[200px]">{eventTitle}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-primary-400">{checkedIn}</p>
          <p className="text-xs text-gray-400">of {totalSold} checked in</p>
        </div>
      </div>

      {/* Camera view */}
      <div className="relative flex-1 flex items-center justify-center">
        <div id="qr-reader" className="w-full max-w-sm" />

        {!scanning && !result && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950">
            <p className="text-gray-400 text-sm">Starting camera…</p>
          </div>
        )}

        {/* Result overlay */}
        {result && overlayColor && (
          <div className={`absolute inset-0 flex flex-col items-center justify-center ${overlayColor} bg-opacity-95`}>
            {result.status === "success" && (
              <>
                <svg className="h-20 w-20 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="mt-3 text-2xl font-bold text-white">Valid</p>
                <p className="mt-1 font-mono text-lg text-green-100">{result.ticketNumber}</p>
                <p className="mt-0.5 text-sm text-green-100">{result.categoryName}</p>
              </>
            )}
            {result.status === "already_scanned" && (
              <>
                <svg className="h-20 w-20 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <p className="mt-3 text-2xl font-bold text-white">Already scanned</p>
                <p className="mt-1 font-mono text-sm text-amber-100">{result.ticketNumber}</p>
                <p className="mt-0.5 text-xs text-amber-100">
                  {new Date(result.checkedInAt).toLocaleTimeString()}
                </p>
              </>
            )}
            {result.status === "invalid" && (
              <>
                <svg className="h-20 w-20 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="mt-3 text-2xl font-bold text-white">Invalid</p>
                <p className="mt-1 text-sm text-red-100">{result.reason}</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Manual entry fallback */}
      <div className="bg-gray-900 border-t border-gray-800 px-4 py-4">
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value.toUpperCase())}
            placeholder="Enter ticket number manually"
            className="flex-1 rounded-lg bg-gray-800 px-3 py-2 text-sm font-mono text-white placeholder-gray-500 border border-gray-700 focus:border-primary-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!manualInput.trim() || validating}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            Check
          </button>
        </form>
      </div>
    </div>
  );
}
