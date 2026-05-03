import type { Anomaly, AnomalyContext } from "./types";

/**
 * Trigger: any failed receipt sends in the last 24 hours. This is a *trust
 * layer* signal — when it fails, members didn't get receipts, which silently
 * undermines the fraud-protection promise.
 *
 * Severity: medium for 1–5, high for >5. We deliberately surface even one
 * failure (the original 6 rules guard tiny samples; this rule does not).
 */
export function detectFailedNotifications(ctx: AnomalyContext): Anomaly | null {
  if (ctx.failedNotifications24h <= 0) return null;
  const severity = ctx.failedNotifications24h > 5 ? "high" : "medium";
  return {
    id: "failed-notifications",
    severity,
    headline: `${ctx.failedNotifications24h} ${ctx.failedNotifications24h === 1 ? "notification" : "notifications"} failed in last 24 hours`,
    subline: "Members may not have received their receipts.",
    actionLabel: "View notifications",
    actionHref: "/settings/notifications",
  };
}
