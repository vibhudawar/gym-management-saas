import { formatMoneyShort } from "@/lib/utils/money";
import { formatRangeLabel } from "@/lib/utils/date-presets";
import type { Anomaly, AnomalyContext } from "./types";

/**
 * Trigger: at least one calendar week within the period has revenue
 * <= 60% of the period's average week.
 * Severity: medium.
 *
 * Skipped when the period is shorter than 2 weeks — averages aren't
 * meaningful for fewer than that.
 */
export function detectSlowWeek(ctx: AnomalyContext): Anomaly | null {
  if (ctx.weeklyNetPaise.length < 2) return null;
  const totals = ctx.weeklyNetPaise.map((w) => w.netPaise);
  const sum = totals.reduce((acc, n) => acc + n, 0);
  if (sum <= 0) return null;
  const avg = sum / totals.length;
  if (avg <= 0) return null;

  const slowest = [...ctx.weeklyNetPaise].sort(
    (a, b) => a.netPaise - b.netPaise,
  )[0];
  if (slowest.netPaise / avg > 0.6) return null;

  return {
    id: "slow-week",
    severity: "medium",
    headline: "Slow week detected",
    subline: `${formatRangeLabel({ from: slowest.weekStart, to: slowest.weekEnd })}: ${formatMoneyShort(slowest.netPaise)} (avg week: ${formatMoneyShort(Math.round(avg))})`,
    actionLabel: "View revenue chart",
    actionHref: `/reports?tab=revenue&from=${ctx.range.from}&to=${ctx.range.to}`,
  };
}
