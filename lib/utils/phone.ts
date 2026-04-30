import { z } from "zod";

export type NormalizedPhone = string; // E.164, e.g. "+919876543210"

const E164_RE = /^\+[1-9]\d{6,14}$/;
const INDIAN_MOBILE_PREFIX = /^[6-9]/;

export function isE164(value: string): boolean {
  return E164_RE.test(value);
}

/**
 * Normalize Indian phone input to E.164 (+91XXXXXXXXXX).
 *
 * Accepts:
 *   "9876543210", "98765 43210", "+91 98765-43210",
 *   "919876543210", "0919876543210", "+919876543210"
 * Returns the canonical E.164 string, or null if invalid.
 *
 * v1: India-only. Internationalisation deferred.
 */
export function normalizeIndianPhone(input: string): NormalizedPhone | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (trimmed === "") return null;

  // Keep a leading + if present, strip everything else non-digit.
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  if (hasPlus) {
    // Must be +91 + 10 digits starting 6-9
    if (digits.length === 12 && digits.startsWith("91")) {
      const local = digits.slice(2);
      if (INDIAN_MOBILE_PREFIX.test(local)) return `+${digits}`;
    }
    return null;
  }

  if (digits.length === 10 && INDIAN_MOBILE_PREFIX.test(digits)) {
    return `+91${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    const local = digits.slice(1);
    if (INDIAN_MOBILE_PREFIX.test(local)) return `+91${local}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    const local = digits.slice(2);
    if (INDIAN_MOBILE_PREFIX.test(local)) return `+${digits}`;
  }
  if (digits.length === 13 && digits.startsWith("091")) {
    const local = digits.slice(3);
    if (INDIAN_MOBILE_PREFIX.test(local)) return `+91${local}`;
  }
  return null;
}

/**
 * Display formatter: "+919876543210" → "+91 98765 43210".
 * Falls back to the raw input if it doesn't look like an Indian number.
 */
export function formatPhoneForDisplay(phone: NormalizedPhone): string {
  if (!isE164(phone)) return phone;
  if (phone.startsWith("+91") && phone.length === 13) {
    const rest = phone.slice(3);
    return `+91 ${rest.slice(0, 5)} ${rest.slice(5)}`;
  }
  return phone;
}

/**
 * Last-N digits of an E.164 number — used for partial phone search.
 */
export function lastDigits(phone: NormalizedPhone, n: number): string {
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-Math.max(1, n));
}

/**
 * Zod schema that accepts any of the loose Indian phone formats and
 * normalises to E.164. Use this in form schemas instead of a raw regex.
 */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => normalizeIndianPhone(v))
  .refine((v): v is NormalizedPhone => v !== null, {
    message: "Enter a valid 10-digit Indian mobile number",
  });

/**
 * Optional variant — accepts empty string / undefined and returns null.
 */
export const phoneSchemaOptional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : normalizeIndianPhone(v)))
  .refine((v) => v === null || E164_RE.test(v), {
    message: "Enter a valid 10-digit Indian mobile number",
  });

/**
 * Backwards-compat alias kept for older callers (e.g. scripts/create-tenant.ts
 * pre-Module-03). New code should call `normalizeIndianPhone` directly.
 */
export const normalisePhone = normalizeIndianPhone;
