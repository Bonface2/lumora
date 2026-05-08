"use client";

import { useState, useRef, useEffect } from "react";
import { DayPicker } from "react-day-picker";
import { format, parse, isValid } from "date-fns";

interface Props {
  value: string; // "YYYY-MM-DD"
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: (date: Date) => boolean;
  error?: string;
}

export function DatePicker({ value, onChange, placeholder = "Pick a date", disabled, error }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const displayValue = selected && isValid(selected) ? format(selected, "dd MMM yyyy") : "";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition-colors text-left ${
          error
            ? "border-red-300 focus:border-red-400 focus:ring-red-100"
            : "border-gray-200 hover:border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        } ${displayValue ? "text-gray-900" : "text-gray-400"}`}
      >
        <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="flex-1">{displayValue || placeholder}</span>
        {displayValue && (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            className="text-gray-400 hover:text-gray-600"
          >
            ×
          </span>
        )}
      </button>

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

      {open && (
        <div className="absolute z-50 mt-1 rounded-2xl border border-gray-200 bg-white p-3 shadow-xl">
          <DayPicker
            mode="single"
            selected={selected && isValid(selected) ? selected : undefined}
            onSelect={(date) => {
              onChange(date ? format(date, "yyyy-MM-dd") : "");
              if (date) setOpen(false);
            }}
            disabled={disabled}
            classNames={{
              root: "text-sm",
              months: "",
              month: "",
              month_caption: "flex items-center justify-center mb-3 px-1",
              caption_label: "text-sm font-semibold text-gray-900",
              nav: "flex items-center justify-between mb-1",
              button_previous: "absolute left-3 top-3 p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors",
              button_next: "absolute right-3 top-3 p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors",
              month_grid: "w-full border-collapse",
              weekdays: "",
              weekday: "text-xs font-medium text-gray-400 pb-2 text-center w-9",
              week: "",
              day: "p-0 text-center",
              day_button: "h-9 w-9 rounded-xl text-sm font-medium transition-colors hover:bg-primary-50 hover:text-primary-700 focus:outline-none",
              selected: "bg-primary-600 text-white hover:bg-primary-700 rounded-xl",
              today: "font-bold text-primary-600",
              outside: "text-gray-300",
              disabled: "text-gray-300 cursor-not-allowed hover:bg-transparent hover:text-gray-300",
              hidden: "invisible",
            }}
          />
        </div>
      )}
    </div>
  );
}
