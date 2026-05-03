import { formatMoneyShort } from "@/lib/utils/money";
import type { Anomaly, AnomalyContext } from "./types";

/**
 * Trigger: net <= 80% of prior net.
 * Severity: high if <=60%, medium if 60-80%.
 */
export function detectRevenueDrop(ctx: AnomalyContext): Anomaly | null {
  if (ctx.priorNetPaise === null) return null;
  if (ctx.priorNetPaise <= 0) return null;
  const ratio = ctx.netPaise / ctx.priorNetPaise;
  if (ratio > 0.8) return null;
  // Guard against tiny prior periods producing noisy alerts.
  if (Math.abs(ctx.priorNetPaise) < 1_000_00) return null; // ₹1,000 minimum prior

  const severity = ratio <= 0.6 ? "high" : "medium";
  const pctDown = Math.round((1 - ratio) * 100);
  const params = new URLSearchParams({
    tab: "revenue",
    from: ctx.range.from,
    to: ctx.range.to,
  });

  return {
    id: "revenue-drop",
    severity,
    headline: "Revenue down",
    subline: `${formatMoneyShort(ctx.netPaise)} this period vs ${formatMoneyShort(ctx.priorNetPaise)} last period (-${pctDown}%)`,
    actionLabel: "View revenue breakdown",
    actionHref: `/reports?${params.toString()}`,
  };
}
