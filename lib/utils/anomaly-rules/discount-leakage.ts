import { formatMoneyShort } from "@/lib/utils/money";
import type { Anomaly, AnomalyContext } from "./types";

/**
 * Trigger: discount given >= 8% of gross.
 * Severity: high if >=15%, medium if 8-15%.
 */
export function detectDiscountLeakage(ctx: AnomalyContext): Anomaly | null {
  if (ctx.grossPaise <= 0) return null;
  if (ctx.discountedCount === 0) return null;
  const pct = ctx.discountPaise / ctx.grossPaise;
  if (pct < 0.08) return null;
  const severity = pct >= 0.15 ? "high" : "medium";
  const pctLabel = `${(pct * 100).toFixed(1)}%`;

  let staffNote = "";
  if (
    ctx.topDiscountStaff &&
    ctx.discountPaise > 0 &&
    ctx.topDiscountStaff.totalPaise / ctx.discountPaise > 0.5
  ) {
    const sharePct = Math.round(
      (ctx.topDiscountStaff.totalPaise / ctx.discountPaise) * 100,
    );
    staffNote = ` ${ctx.topDiscountStaff.name} gave ${sharePct}% of it.`;
  }

  const params = new URLSearchParams({
    tab: "discounts",
    from: ctx.range.from,
    to: ctx.range.to,
  });

  return {
    id: "discount-leakage",
    severity,
    headline: severity === "high" ? "Discount leakage high" : "Discount leakage rising",
    subline: `${formatMoneyShort(ctx.discountPaise)} given (${pctLabel} of gross).${staffNote}`,
    actionLabel: "View discount details",
    actionHref: `/reports?${params.toString()}`,
  };
}
