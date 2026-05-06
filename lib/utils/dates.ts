import { format, formatDistanceToNow, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

const IST = "Asia/Kolkata";

/**
 * Today's calendar date in IST as a YYYY-MM-DD string. Use this when computing
 * "today's revenue" or "expiring in 14 days" — anchoring to IST avoids the
 * 11:55 PM bug where a payment lands in UTC's "tomorrow".
 */
export function todayIstIso(): string {
  return formatInTimeZone(new Date(), IST, "yyyy-MM-dd");
}

/**
 * Returns a Date's calendar date as YYYY-MM-DD using its UTC value. Use this
 * when `d` is the result of UTC date arithmetic — e.g. `addDaysIso` builds
 * its Dates as `new Date(\`${iso}T00:00:00Z\`)` + setUTCDate, and the caller
 * needs the resulting ISO. For "today" anchored to IST, prefer `todayIstIso()`.
 */
export function dateToIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Add N days to a YYYY-MM-DD ISO date string and return YYYY-MM-DD. Pure
 * calendar arithmetic via UTC midnight — no DST or timezone shenanigans.
 */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Inclusive day count between two YYYY-MM-DD strings (both ends counted as
 * calendar days). `startIso === endIso` returns 1. Returns 0 when endIso is
 * before startIso, so callers don't need their own guard.
 */
export function daysBetweenInclusiveIso(
  startIso: string,
  endIso: string,
): number {
  if (endIso < startIso) return 0;
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

/**
 * Format a UTC timestamp (Date or ISO string) for display in IST.
 * Default format: "12 Mar 2024".
 */
export function formatDate(
  input: Date | string,
  pattern = "dd MMM yyyy",
): string {
  const date = typeof input === "string" ? parseISO(input) : input;
  return formatInTimeZone(date, IST, pattern);
}

/**
 * "12 Mar 2024, 4:30 pm" — for audit log lines etc.
 */
export function formatDateTime(input: Date | string): string {
  return formatDate(input, "dd MMM yyyy, h:mm a");
}

/**
 * Best-effort relative time ("2 hours ago"). Uses local clock — fine for
 * recent past on a personal device.
 */
export function formatRelative(input: Date | string): string {
  const date = typeof input === "string" ? parseISO(input) : input;
  return formatDistanceToNow(date, { addSuffix: true });
}

/**
 * Format a "YYYY-MM-DD" date column for display. Treats it as a calendar
 * date (no timezone shift), since Postgres `date` columns are tz-naïve.
 */
export function formatCalendarDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return format(parseISO(value), "dd MMM yyyy");
}
