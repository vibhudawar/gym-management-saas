import { dateToIso } from "./dates";
import {
  daysInRange,
  inferPreset,
  resolvePreset,
  type DateRange,
} from "./date-presets";

/**
 * Map the current date range to its "natural prior period" for comparisons.
 *
 * - Calendar presets (this/last month, quarter, year, week) use the matching
 *   prior calendar period — even if month lengths differ. "This month" of
 *   April compares against March, not "the previous 30 days".
 * - Today / Yesterday use yesterday / day-before respectively.
 * - Custom ranges use the same-length window immediately before `from`.
 *
 * Returns `null` when no sensible prior period exists (e.g., we're already
 * on yesterday and there is no "day before yesterday" preset).
 */
export function getPreviousPeriod(range: DateRange): DateRange | null {
  const preset = inferPreset(range);
  switch (preset) {
    case "today":
      return resolvePreset("yesterday");
    case "yesterday":
      return shiftCustom(range);
    case "last_7_days":
      return shiftCustom(range);
    case "this_week":
      return resolvePreset("last_week");
    case "last_week":
      return shiftCustom(range);
    case "this_month":
      return resolvePreset("last_month");
    case "last_month":
      return shiftCustom(range);
    case "this_quarter":
      return resolvePreset("last_quarter");
    case "last_quarter":
      return shiftCustom(range);
    case "this_year":
      // No "last_year" preset; shift back by 365/366.
      return shiftCustom(range);
    case "custom":
      return shiftCustom(range);
  }
}

/**
 * Shift a range back by its own length so the prior period is the same number
 * of days immediately before `from`.
 */
function shiftCustom(range: DateRange): DateRange {
  const days = daysInRange(range);
  const fromDate = new Date(`${range.from}T00:00:00Z`);
  const newTo = new Date(fromDate);
  newTo.setUTCDate(newTo.getUTCDate() - 1);
  const newFrom = new Date(newTo);
  newFrom.setUTCDate(newFrom.getUTCDate() - (days - 1));
  return {
    from: dateToIso(newFrom),
    to: dateToIso(newTo),
  };
}

export type DeltaTone = "good" | "bad" | "neutral";

/**
 * Compute an integer percentage delta (current vs prior) and a tone hint.
 *
 * `metricKind` controls whether "up" reads as good/bad/neutral. Revenue +
 * net + enrolments are unambiguously good when up, bad when down. Refunds
 * and discounts are *neutral* — the system shouldn't editorialize on them
 * (a refund drop might mean staff stopped processing legitimate refund
 * requests; a discount drop might mean staff is losing sales).
 */
export function deltaPercent(
  current: number,
  prior: number,
): { pct: number | null; absChange: number; direction: "up" | "down" | "flat" } {
  if (prior === 0 && current === 0) {
    return { pct: 0, absChange: 0, direction: "flat" };
  }
  if (prior === 0) {
    return { pct: null, absChange: current, direction: current > 0 ? "up" : "down" };
  }
  const change = current - prior;
  if (change === 0) return { pct: 0, absChange: 0, direction: "flat" };
  const pct = Math.round((change / prior) * 100);
  return { pct, absChange: change, direction: change > 0 ? "up" : "down" };
}

export function tonefor(
  metric: "revenue" | "enrolments" | "refund" | "discount" | "neutral",
  direction: "up" | "down" | "flat",
): DeltaTone {
  if (direction === "flat") return "neutral";
  if (metric === "refund" || metric === "discount" || metric === "neutral") {
    return "neutral";
  }
  return direction === "up" ? "good" : "bad";
}
