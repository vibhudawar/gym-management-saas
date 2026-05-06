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
