/** Indian mobile-style: digits only, exactly 10. */

export function digitsOnly(value: string, maxLength = 10): string {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

/** Prefer last 10 digits when pasting +91 / 0-prefixed numbers. */
export function normalizePhone(value: string): string {
  const d = value.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) return d.slice(2);
  if (d.length === 11 && d.startsWith("0")) return d.slice(1);
  if (d.length > 10) return d.slice(-10);
  return d;
}

export function isValidPhone(value: string): boolean {
  return /^\d{10}$/.test(value.trim());
}

/** Returns an error message, or null if valid. Empty is invalid when required. */
export function phoneError(
  value: string,
  opts: { required?: boolean; label?: string } = {}
): string | null {
  const label = opts.label ?? "Phone";
  const required = opts.required ?? true;
  const trimmed = value.trim();
  if (!trimmed) return required ? `${label} must be 10 digits.` : null;
  if (/\D/.test(trimmed)) return `${label} must contain only numbers.`;
  if (trimmed.length !== 10) return `${label} must be exactly 10 digits.`;
  return null;
}
