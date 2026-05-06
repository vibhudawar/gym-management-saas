/**
 * Tunable thresholds used by the rule-based anomaly detector at
 * `lib/utils/anomaly-rules/*`. Centralised here so policy changes are a
 * single-file edit and can later migrate to a `gyms.anomaly_config` jsonb
 * column for per-tenant tuning.
 *
 * Numbers are documented inline next to each rule that consumes them. If
 * you change one, update the rule's docstring trigger description too.
 */
export const ANOMALY_THRESHOLDS = {
  /** Revenue is "down" when net <= 80% of prior net. */
  REVENUE_DROP_RATIO: 0.8,
  /** "High" severity revenue drop: net <= 60% of prior net. */
  REVENUE_DROP_HIGH_SEVERITY_RATIO: 0.6,
  /**
   * Minimum prior-period net (paise) to consider for a revenue-drop
   * comparison — guards against tiny prior periods producing noisy alerts.
   * ₹1,000 = 100,000 paise.
   */
  REVENUE_DROP_MIN_PRIOR_PAISE: 1_000_00,

  /** Refunds-spike trigger: refunds >= N× prior period AND >=2 refunds this period. */
  REFUND_SPIKE_MULTIPLIER: 3,
  /** Minimum refund count this period before the spike rule fires at all. */
  REFUND_SPIKE_MIN_REFUND_COUNT: 2,
  /** Refund spike escalates to high if ratio >= this. */
  REFUND_SPIKE_HIGH_SEVERITY_MULTIPLIER: 5,
  /** Refund spike also escalates to high when refunds > this fraction of gross. */
  REFUND_SPIKE_HIGH_SEVERITY_PCT_OF_GROSS: 0.1,

  /** Discount leakage: discounts given >= N% of gross. */
  DISCOUNT_LEAKAGE_RATIO: 0.08,
  /** Discount leakage escalates to high when ratio >= this. */
  DISCOUNT_LEAKAGE_HIGH_SEVERITY_RATIO: 0.15,
  /** A single staff member is flagged when they gave > this share of all discounts. */
  DISCOUNT_LEAKAGE_TOP_STAFF_SHARE: 0.5,

  /** Single membership is "large discount" when >= N% off plan price. */
  LARGE_DISCOUNT_RATIO: 0.25,

  /** Member loss: lapsed >= N× prior. */
  MEMBER_LOSS_RATIO: 1.5,
  /** Tiny-sample guard: ignore if prior lapsed count below this. */
  MEMBER_LOSS_MIN_PRIOR_COUNT: 2,
  /** Member loss escalates to high when ratio >= this AND abs count exceeds the floor. */
  MEMBER_LOSS_HIGH_SEVERITY_RATIO: 3,
  /** Absolute count floor for "high" severity in member-loss rule. */
  MEMBER_LOSS_HIGH_SEVERITY_MIN_COUNT: 5,

  /** A week is "slow" when its net <= N× the period's average week. */
  SLOW_WEEK_RATIO: 0.6,

  /** Failed-notifications rule escalates to high when count > this in last 24h. */
  FAILED_NOTIFICATIONS_HIGH_SEVERITY_COUNT: 5,
} as const;
