"use client";

import { cn } from "@/lib/utils";

export type StatusOption = {
  value: string;
  label: string;
};

export function StatusPills({
  value,
  options,
  onChange,
  disabled,
  className,
}: {
  value: string;
  options: StatusOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => {
              if (!active) onChange(opt.value);
            }}
            className={cn(
              "min-h-10 rounded-xl px-3 text-sm font-medium transition-colors",
              active
                ? "bg-emerald-600 text-white"
                : "border-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              disabled && "opacity-60"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export const LISTING_STATUS_OPTIONS: StatusOption[] = [
  { value: "available", label: "Available" },
  { value: "unavailable", label: "Unavailable" },
  { value: "hold", label: "On hold" },
];

export const LEAD_STATUS_OPTIONS: StatusOption[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "closed", label: "Closed" },
];

export function listingStatusLabel(status: string): string {
  if (status === "hold") return "On hold";
  return status.charAt(0).toUpperCase() + status.slice(1);
}
