import { formatInTimeZone } from "date-fns-tz";

const IST = "Asia/Kolkata";

export type DateRange = {
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD inclusive
};

export type DatePresetKey =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "last_quarter"
  | "this_year"
  | "custom";

export const DATE_PRESETS: ReadonlyArray<{
  key: Exclude<DatePresetKey, "custom">;
  label: string;
}> = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last_7_days", label: "Last 7 days" },
  { key: "this_week", label: "This week" },
  { key: "last_week", label: "Last week" },
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "this_quarter", label: "This quarter" },
  { key: "last_quarter", label: "Last quarter" },
  { key: "this_year", label: "This year" },
];

const DATE_FMT = "yyyy-MM-dd";

function istNow(): Date {
  // formatInTimeZone gives the wall-clock string in IST; rebuild a Date from it
  // so date math (setDate, etc.) operates in the right calendar context.
  const iso = formatInTimeZone(new Date(), IST, "yyyy-MM-dd'T'HH:mm:ss");
  return new Date(iso + "+05:30");
}

function toIstIso(d: Date): string {
  return formatInTimeZone(d, IST, DATE_FMT);
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function startOfWeekMonday(d: Date): Date {
  const out = startOfDay(d);
  const dow = out.getDay(); // 0 = Sun, 1 = Mon, …
  const offset = dow === 0 ? -6 : 1 - dow;
  return addDays(out, offset);
}

function startOfMonth(d: Date): Date {
  const out = startOfDay(d);
  out.setDate(1);
  return out;
}

function endOfMonth(d: Date): Date {
  const out = startOfMonth(d);
  out.setMonth(out.getMonth() + 1);
  return addDays(out, -1);
}

function startOfQuarter(d: Date): Date {
  const out = startOfDay(d);
  const m = out.getMonth();
  const qStart = m - (m % 3);
  out.setMonth(qStart, 1);
  return out;
}

function endOfQuarter(d: Date): Date {
  const out = startOfQuarter(d);
  out.setMonth(out.getMonth() + 3);
  return addDays(out, -1);
}

function startOfYear(d: Date): Date {
  const out = startOfDay(d);
  out.setMonth(0, 1);
  return out;
}

function endOfYear(d: Date): Date {
  const out = startOfYear(d);
  out.setMonth(11, 31);
  return out;
}

/**
 * Resolve a preset key to an inclusive IST date range. All math runs in IST so
 * "today" at 11:55 PM IST is still today's range, not tomorrow's UTC range.
 */
export function resolvePreset(
  key: Exclude<DatePresetKey, "custom">,
): DateRange {
  const now = istNow();
  const today = startOfDay(now);

  switch (key) {
    case "today":
      return { from: toIstIso(today), to: toIstIso(today) };
    case "yesterday": {
      const y = addDays(today, -1);
      return { from: toIstIso(y), to: toIstIso(y) };
    }
    case "last_7_days": {
      // Rolling 7 days inclusive of today: 6 days back → today.
      const start = addDays(today, -6);
      return { from: toIstIso(start), to: toIstIso(today) };
    }
    case "this_week": {
      const start = startOfWeekMonday(today);
      const end = addDays(start, 6);
      return { from: toIstIso(start), to: toIstIso(end) };
    }
    case "last_week": {
      const thisStart = startOfWeekMonday(today);
      const start = addDays(thisStart, -7);
      const end = addDays(thisStart, -1);
      return { from: toIstIso(start), to: toIstIso(end) };
    }
    case "this_month":
      return { from: toIstIso(startOfMonth(today)), to: toIstIso(endOfMonth(today)) };
    case "last_month": {
      const start = startOfMonth(today);
      start.setMonth(start.getMonth() - 1);
      const end = endOfMonth(start);
      return { from: toIstIso(start), to: toIstIso(end) };
    }
    case "this_quarter":
      return {
        from: toIstIso(startOfQuarter(today)),
        to: toIstIso(endOfQuarter(today)),
      };
    case "last_quarter": {
      const start = startOfQuarter(today);
      start.setMonth(start.getMonth() - 3);
      const end = endOfQuarter(start);
      return { from: toIstIso(start), to: toIstIso(end) };
    }
    case "this_year":
      return {
        from: toIstIso(startOfYear(today)),
        to: toIstIso(endOfYear(today)),
      };
  }
}

/**
 * Best-effort reverse lookup — given a custom from/to, see if it matches any
 * preset so the picker can highlight the matching item.
 */
export function inferPreset(range: DateRange): DatePresetKey {
  for (const preset of DATE_PRESETS) {
    const r = resolvePreset(preset.key);
    if (r.from === range.from && r.to === range.to) return preset.key;
  }
  return "custom";
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateRange(range: Partial<DateRange>): range is DateRange {
  if (!range.from || !range.to) return false;
  if (!ISO_DATE.test(range.from) || !ISO_DATE.test(range.to)) return false;
  return range.from <= range.to;
}

export function daysInRange(range: DateRange): number {
  const start = new Date(`${range.from}T00:00:00Z`);
  const end = new Date(`${range.to}T00:00:00Z`);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

/**
 * Choose a chart aggregation strategy based on range length so we never render
 * 365 daily bars on the revenue tab.
 */
export function chooseAggregation(
  range: DateRange,
): "daily" | "weekly" | "monthly" {
  const d = daysInRange(range);
  if (d > 365) return "monthly";
  if (d > 90) return "weekly";
  return "daily";
}

export function formatRangeLabel(range: DateRange): string {
  const sameYear = range.from.slice(0, 4) === range.to.slice(0, 4);
  const fromLabel = formatInTimeZone(
    new Date(`${range.from}T00:00:00Z`),
    "UTC",
    sameYear ? "d MMM" : "d MMM yyyy",
  );
  const toLabel = formatInTimeZone(
    new Date(`${range.to}T00:00:00Z`),
    "UTC",
    "d MMM yyyy",
  );
  if (range.from === range.to) return toLabel;
  return `${fromLabel} – ${toLabel}`;
}
