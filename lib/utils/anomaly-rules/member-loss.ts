import type { Anomaly, AnomalyContext } from "./types";

/**
 * Trigger: lapsed-not-renewed count >= 1.5× prior period's.
 * Severity: high if >=3× and abs >5; medium otherwise.
 */
export function detectMemberLoss(ctx: AnomalyContext): Anomaly | null {
  if (ctx.priorLapsedCount === null) return null;
  // Tiny-sample guard: ratio comparisons are noisy below this floor.
  if (ctx.priorLapsedCount < 2) return null;
  const ratio = ctx.lapsedCount / ctx.priorLapsedCount;
  if (ratio < 1.5) return null;
  const severity = ratio >= 3 && ctx.lapsedCount > 5 ? "high" : "medium";

  return {
    id: "member-loss",
    severity,
    headline: "More members lapsing",
    subline: `${ctx.lapsedCount} members didn't renew (was ${ctx.priorLapsedCount} last period)`,
    actionLabel: "View lapsed members",
    actionHref: "/members?membership=expired",
  };
}
