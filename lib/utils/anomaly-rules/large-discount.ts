import { formatMoneyShort } from "@/lib/utils/money";
import type { Anomaly, AnomalyContext } from "./types";

const THRESHOLD = 0.25; // 25% off plan price

/**
 * Trigger: any single membership has discount >=25% of its plan price.
 * Severity: medium (always — large concentrated discounts are noteworthy
 *   but not emergencies on their own).
 */
export function detectLargeDiscount(ctx: AnomalyContext): Anomaly | null {
  const big = ctx.largeDiscountMemberships
    .filter(
      (m) => m.planPricePaise > 0 && m.discountPaise / m.planPricePaise >= THRESHOLD,
    )
    .sort((a, b) => b.discountPaise - a.discountPaise);

  if (big.length === 0) return null;

  const top = big[0];
  const topPct = Math.round((top.discountPaise / top.planPricePaise) * 100);

  if (big.length === 1) {
    return {
      id: "large-discount",
      severity: "medium",
      headline: "Large discount given",
      subline: `${top.memberName} received ${topPct}% off their ${top.planName} (${formatMoneyShort(top.discountPaise)} discount)`,
      actionLabel: "View member",
      actionHref: `/members/${top.memberId}`,
    };
  }

  return {
    id: "large-discount",
    severity: "medium",
    headline: `${big.length} large discounts given`,
    subline: `${top.memberName} ${topPct}% off ${top.planName} (${formatMoneyShort(top.discountPaise)}) — and ${big.length - 1} more`,
    actionLabel: "View discount details",
    actionHref: `/reports?tab=discounts&from=${ctx.range.from}&to=${ctx.range.to}`,
  };
}
