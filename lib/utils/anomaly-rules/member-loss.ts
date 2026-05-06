import { ANOMALY_THRESHOLDS } from "@/lib/constants/anomaly-thresholds";
import type { Anomaly, AnomalyContext } from "./types";

/**
 * Trigger: lapsed-not-renewed count >= 1.5× prior period's.
 * Severity: high if >=3× and abs >5; medium otherwise.
 */
export function detectMemberLoss(ctx: AnomalyContext): Anomaly | null {
  if (ctx.priorLapsedCount === null) return null;
  // Tiny-sample guard: ratio comparisons are noisy below this floor.
  if (ctx.priorLapsedCount < ANOMALY_THRESHOLDS.MEMBER_LOSS_MIN_PRIOR_COUNT) return null;
  const ratio = ctx.lapsedCount / ctx.priorLapsedCount;
  if (ratio < ANOMALY_THRESHOLDS.MEMBER_LOSS_RATIO) return null;
  const severity =
    ratio >= ANOMALY_THRESHOLDS.MEMBER_LOSS_HIGH_SEVERITY_RATIO &&
    ctx.lapsedCount > ANOMALY_THRESHOLDS.MEMBER_LOSS_HIGH_SEVERITY_MIN_COUNT
      ? "high"
      : "medium";

  return {
    id: "member-loss",
    severity,
    headline: "More members lapsing",
    subline: `${ctx.lapsedCount} members didn't renew (was ${ctx.priorLapsedCount} last period)`,
    actionLabel: "View lapsed members",
    actionHref: "/members?membership=expired",
  };
}
