"use client";

import { useState, useRef, useEffect } from "react";
import { DayPicker } from "react-day-picker";
import { format, parse, isValid, startOfDay } from "date-fns";

interface Props {
  value: string; // "YYYY-MM-DDTHH:mm"
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  minDateTime?: string; // "YYYY-MM-DDTHH:mm" — blocks dates/times before this
}

const ALL_HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const ALL_MINUTES = ["00", "15", "30", "45"];

export function DateTimePicker({ value, onChange, placeholder = "Pick date & time", error, minDateTime }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const parsed = value ? parse(value, "yyyy-MM-dd'T'HH:mm", new Date()) : undefined;
  const selected = parsed && isValid(parsed) ? parsed : undefined;

  const datePart = value?.slice(0, 10) ?? "";
  const timePart = value?.slice(11, 16) ?? "00:00";
  const [hour, minute] = timePart.split(":");

  const displayValue = selected ? format(selected, "dd MMM yyyy, HH:mm") : "";

  // Parse minDateTime parts
  const minDatePart = minDateTime?.slice(0, 10) ?? "";
  const minHour = minDateTime?.slice(11, 13) ?? "00";
  const minMinute = minDateTime?.slice(14, 16) ?? "00";
  const minDateObj = minDatePart ? startOfDay(parse(minDatePart, "yyyy-MM-dd", new Date())) : undefined;

  // On the same day as min, restrict available hours and minutes
  const isMinDay = !!minDatePart && datePart === minDatePart;
  const availableHours = ALL_HOURS.filter((h) => !isMinDay || h >= minHour);
  const availableMinutes = ALL_MINUTES.filter((m) => !isMinDay || (hour ?? "00") > minHour || m >= minMinute);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function emitChange(newDatePart: string, newHour: string, newMinute: string) {
    if (!newDatePart) { onChange(""); return; }
    onChange(`${newDatePart}T${newHour}:${newMinute}`);
  }

  function handleDaySelect(date: Date | undefined) {
    const newDate = date ? format(date, "yyyy-MM-dd") : "";
    if (!newDate) { emitChange("", "00", "00"); return; }

    // Auto-correct time if it falls before the min on the same day
    let newHour = hour ?? "00";
    let newMinute = minute ?? "00";
    if (minDateTime && newDate === minDatePart) {
      if (newHour < minHour) {
        newHour = minHour;
        newMinute = minMinute;
      } else if (newHour === minHour && newMinute < minMinute) {
        newMinute = minMinute;
      }
    }
    emitChange(newDate, newHour, newMinute);
  }

  function handleHourChange(newHour: string) {
    let newMinute = minute ?? "00";
    // If on min day and the new hour equals min hour, ensure minute is valid
    if (isMinDay && newHour === minHour && newMinute < minMinute) {
      newMinute = minMinute;
    }
    emitChange(datePart, newHour, newMinute);
  }

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
        <div className="absolute z-50 mt-1 rounded-2xl border border-gray-200 bg-white shadow-xl">
          <div className="p-3">
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={handleDaySelect}
              disabled={minDateObj ? { before: minDateObj } : undefined}
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

          {/* Time picker */}
          <div className="border-t border-gray-100 px-4 py-3">
            <p className="mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Time</p>
            <div className="flex items-center gap-2">
              <select
                value={hour ?? "00"}
                onChange={(e) => handleHourChange(e.target.value)}
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                {availableHours.map((h) => (
                  <option key={h} value={h}>{h}:00</option>
                ))}
              </select>
              <span className="text-gray-400 font-bold">:</span>
              <select
                value={minute ?? "00"}
                onChange={(e) => emitChange(datePart, hour ?? "00", e.target.value)}
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                {availableMinutes.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {datePart && (
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-bold text-white hover:bg-primary-700 transition-colors"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
