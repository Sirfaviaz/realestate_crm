import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(value: number | null | undefined, stream: string = "sales") {
  if (value == null) return "—";
  if (stream === "rental") {
    return `₹${value.toLocaleString("en-IN")}/mo`;
  }
  if (value >= 10000000) {
    return `₹${(value / 10000000).toFixed(2)} Cr`;
  }
  if (value >= 100000) {
    return `₹${(value / 100000).toFixed(2)} L`;
  }
  return `₹${value.toLocaleString("en-IN")}`;
}

export function formatSqft(value: number | null | undefined) {
  if (value == null) return "—";
  return `${value.toLocaleString("en-IN")} sqft`;
}
