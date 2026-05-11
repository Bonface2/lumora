"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface Event {
  id: string;
  title: string;
}

interface Props {
  events: Event[];
}

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

function buildExportUrl(eventIds: string[], format: string) {
  const params = new URLSearchParams();
  params.set("format", format);
  for (const id of eventIds) {
    params.append("event", id);
  }
  return `/api/seller/export?${params.toString()}`;
}

export function ExportModal({ events }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(events.map((e) => e.id)) : new Set());
  }

  function toggleEvent(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = events.length > 0 && selected.size === events.length;
  const someSelected = selected.size > 0 && !allSelected;

  // Build the URL: if all or none selected, export all (omit event params)
  const exportIds = selected.size > 0 && !allSelected ? Array.from(selected) : [];

  function handleDownload(format: string) {
    window.location.href = buildExportUrl(exportIds, format);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setSelected(new Set()); setOpen(true); }}
        className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-300 hover:bg-white/10 transition-colors"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Export
      </button>

      {open && (
        <Modal onClose={() => setOpen(false)}>
          <h3 className="text-base font-bold text-gray-900">Export data</h3>
          <p className="mt-1 text-sm text-gray-500">
            Choose which events to include in your export.
          </p>

          <div className="mt-4 max-h-64 overflow-y-auto rounded-xl border border-gray-100">
            <label className="flex cursor-pointer items-center gap-3 border-b border-gray-100 px-4 py-3 hover:bg-gray-50">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => { if (el) el.indeterminate = someSelected; }}
                onChange={(e) => toggleAll(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600"
              />
              <span className="text-sm font-semibold text-gray-700">All events</span>
            </label>
            {events.map((e) => (
              <label
                key={e.id}
                className="flex cursor-pointer items-center gap-3 border-b border-gray-50 px-4 py-3 last:border-0 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selected.has(e.id)}
                  onChange={() => toggleEvent(e.id)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600"
                />
                <span className="text-sm text-gray-700 truncate">{e.title}</span>
              </label>
            ))}
          </div>

          <p className="mt-3 text-xs text-gray-400">
            {selected.size === 0 || allSelected
              ? "All events will be exported."
              : `${selected.size} event${selected.size !== 1 ? "s" : ""} selected.`}
          </p>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => handleDownload("csv")}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              CSV
            </button>
            <button
              onClick={() => handleDownload("xlsx")}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-700 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Excel
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
