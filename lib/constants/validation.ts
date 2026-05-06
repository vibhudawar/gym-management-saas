/**
 * 15-character Indian GSTIN format. Catches typos but does NOT verify the
 * checksum digit (algorithm exists but is brittle and rarely worth the
 * complexity at gym-onboarding scale).
 *
 * Layout: 2 digits state + 10 chars PAN + 1 entity-number + 1 fixed 'Z' +
 * 1 checksum char.
 */
export const GSTIN_PATTERN =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/**
 * Invoice prefix used at gym creation and editable later via Settings.
 * Uppercase letters, digits, and hyphens. 2–10 chars so it stays scannable
 * on receipts (`ZEN-2026-0042`).
 */
export const INVOICE_PREFIX_PATTERN = /^[A-Z0-9-]{2,10}$/;

/**
 * Minimum length of the free-text "reason" field on destructive or
 * audit-impacting actions: cancellations, refunds, freezes, unfreezes,
 * corrections. Keeps the audit log meaningful — owners can't just type "ok".
 *
 * Adjust uniformly across all five services if the policy ever changes.
 */
export const MIN_REASON_CHARS = 10;
