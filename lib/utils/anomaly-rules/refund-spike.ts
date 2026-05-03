import { formatMoneyShort } from "@/lib/utils/money";
import type { Anomaly, AnomalyContext } from "./types";

/**
 * Trigger: refunds >= 3× prior period AND >=2 refunds this period.
 * Severity: high if >=5× prior OR refunds >10% of gross; medium otherwise.
 */
export function detectRefundSpike(ctx: AnomalyContext): Anomaly | null {
  if (ctx.refundCount < 2) return null;
  if (ctx.priorRefundsPaise === null || ctx.priorRefundCount === null) return null;
  if (ctx.priorRefundsPaise === 0) return null;
  const ratio = ctx.refundsPaise / ctx.priorRefundsPaise;
  if (ratio < 3) return null;

  const pctOfGross = ctx.grossPaise > 0 ? ctx.refundsPaise / ctx.grossPaise : 0;
  const severity = ratio >= 5 || pctOfGross > 0.1 ? "high" : "medium";

  const ratioRounded = Math.round(ratio * 10) / 10;
  const params = new URLSearchParams({
    kind: "refund",
    from: ctx.range.from,
    to: ctx.range.to,
  });

  return {
    id: "refund-spike",
    severity,
    headline: "Refunds spiked",
    subline: `${formatMoneyShort(ctx.refundsPaise)} across ${ctx.refundCount} ${
      ctx.refundCount === 1 ? "refund" : "refunds"
    } — ${ratioRounded}× more than last period`,
    actionLabel: "View payments",
    actionHref: `/payments?${params.toString()}`,
  };
}
