import { formatCalendarDate } from "@/lib/utils/dates";

export type ReminderTemplateKind = "expiring" | "expired";

export type ReminderTemplateInput = {
  memberName: string;
  planName: string;
  endDate: string; // YYYY-MM-DD
  daysFromToday: number; // negative for expired, positive for expiring
  gymName: string;
  branchName: string;
};

/**
 * Deterministic, role-tagged WhatsApp message templates. Owner-customizable
 * later (deferred); v1 is hardcoded with name, plan, dates, and the gym /
 * branch interpolated server-side.
 */
export function buildReminderTemplate(
  kind: ReminderTemplateKind,
  input: ReminderTemplateInput,
): string {
  const firstName = input.memberName.trim().split(/\s+/)[0] ?? input.memberName;
  const formattedEnd = formatCalendarDate(input.endDate);

  if (kind === "expiring") {
    const days = Math.max(0, input.daysFromToday);
    const inDays =
      days === 0
        ? "today"
        : days === 1
          ? "tomorrow"
          : `in ${days} days`;
    return (
      `Hi ${firstName}, this is a reminder that your ${input.planName} ` +
      `membership at ${input.gymName} ends on ${formattedEnd} (${inDays}). ` +
      `Please drop by to renew at your convenience. — ${input.gymName}, ${input.branchName}`
    );
  }

  const days = Math.max(0, -input.daysFromToday);
  const ago =
    days === 0
      ? "today"
      : days === 1
        ? "yesterday"
        : `${days} days ago`;
  return (
    `Hi ${firstName}, your ${input.planName} membership at ${input.gymName} ` +
    `expired on ${formattedEnd} (${ago}). We'd love to have you back — drop ` +
    `by anytime to renew. — ${input.gymName}, ${input.branchName}`
  );
}

/**
 * Build a `wa.me` URL with a pre-filled message. Phone is E.164 with the
 * leading `+` stripped (wa.me's format).
 */
export function buildWhatsAppUrl(phoneE164: string, message: string): string {
  const phone = phoneE164.startsWith("+") ? phoneE164.slice(1) : phoneE164;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
