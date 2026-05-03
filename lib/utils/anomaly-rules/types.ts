import type { DateRange } from "@/lib/utils/date-presets";

export type Severity = "medium" | "high";

/**
 * AI-readiness contract: the UI never reasons about *why* a card showed up.
 * It only renders {headline, subline, severity, action}. Today the source is
 * the rule-based detector below; tomorrow the same shape can come from an
 * AI summarizer. Anything in this file must remain serializable.
 */
export type Anomaly = {
  id: string;
  severity: Severity;
  headline: string;
  subline: string;
  actionLabel: string;
  actionHref: string;
};

/**
 * Snapshot fed into every rule. Each rule reads only what it needs and
 * returns either an Anomaly or null. Keeping rules pure + side-effect-free
 * makes them trivially unit-testable.
 */
export type AnomalyContext = {
  range: DateRange;
  prior: DateRange | null;
  /** Net revenue this period (paise). */
  netPaise: number;
  /** Net revenue prior period (paise). null when no prior data. */
  priorNetPaise: number | null;
  /** Gross plan_price + addons summed across memberships in range (paise). */
  grossPaise: number;
  /** Sum of refund amounts (positive paise; we negate the negatives in DB). */
  refundsPaise: number;
  refundCount: number;
  priorRefundsPaise: number | null;
  priorRefundCount: number | null;
  /** Sum of discount_paise across in-range memberships (paise). */
  discountPaise: number;
  discountedCount: number;
  /** Top discount-giver: { name, totalPaise } or null when no discounts. */
  topDiscountStaff: { name: string; totalPaise: number } | null;
  /** Memberships with the largest single discount (relative to plan price). */
  largeDiscountMemberships: Array<{
    memberId: string;
    memberName: string;
    planName: string;
    discountPaise: number;
    planPricePaise: number;
  }>;
  /** Lapsed (expired and not yet renewed) count this period vs prior. */
  lapsedCount: number;
  priorLapsedCount: number | null;
  /** Per-week net revenue across the current period; weeks Mon-Sun. */
  weeklyNetPaise: Array<{ weekStart: string; weekEnd: string; netPaise: number }>;
  /** Number of `notifications` rows with status='failed' in the last 24 hours. */
  failedNotifications24h: number;
};
