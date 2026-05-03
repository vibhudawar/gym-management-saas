import { detectDiscountLeakage } from "@/lib/utils/anomaly-rules/discount-leakage";
import { detectFailedNotifications } from "@/lib/utils/anomaly-rules/failed-notifications";
import { detectLargeDiscount } from "@/lib/utils/anomaly-rules/large-discount";
import { detectMemberLoss } from "@/lib/utils/anomaly-rules/member-loss";
import { detectRefundSpike } from "@/lib/utils/anomaly-rules/refund-spike";
import { detectRevenueDrop } from "@/lib/utils/anomaly-rules/revenue-drop";
import { detectSlowWeek } from "@/lib/utils/anomaly-rules/slow-week";
import type { Anomaly, AnomalyContext } from "@/lib/utils/anomaly-rules/types";

const SEVERITY_RANK: Record<Anomaly["severity"], number> = {
  high: 0,
  medium: 1,
};

/**
 * Run every rule and return the firing anomalies, sorted high-to-medium.
 * Within the same severity tier we keep the order rules are listed below —
 * which matches "biggest business impact first" (revenue → discounts → refunds).
 */
export function detectAnomalies(ctx: AnomalyContext): Anomaly[] {
  const rules = [
    detectRevenueDrop,
    detectFailedNotifications,
    detectDiscountLeakage,
    detectLargeDiscount,
    detectRefundSpike,
    detectMemberLoss,
    detectSlowWeek,
  ];
  const found: Anomaly[] = [];
  for (const rule of rules) {
    const result = rule(ctx);
    if (result) found.push(result);
  }
  return found.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}
