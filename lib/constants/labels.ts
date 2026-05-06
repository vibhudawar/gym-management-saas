/**
 * Display labels for enum-typed columns. UI-facing strings only — never used
 * in queries, audit logs, or stored data. When an i18n layer lands these are
 * the obvious place to swap in t().
 */

import type { MemberGender } from "@/lib/db/schema/members";
import type { PaymentMode } from "@/lib/db/schema/payments";

export const GENDER_LABELS: Record<MemberGender, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
  prefer_not_to_say: "Prefer not to say",
};

/**
 * Compact labels for the short payment-mode column shown on tables. The
 * "Bank" abbreviation for `bank_transfer` is intentional — full text wraps
 * awkwardly in a 60px-wide table cell.
 */
export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  bank_transfer: "Bank",
};
