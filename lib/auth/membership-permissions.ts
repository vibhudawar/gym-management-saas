import { formatInTimeZone } from "date-fns-tz";
import type { Role } from "./roles";

const IST = "Asia/Kolkata";
const RECEPTIONIST_WINDOW_MIN = 60;
const OWNER_WINDOW_DAYS = 90;

export type CorrectionLevel = "receptionist" | "manager" | "owner";

export type CorrectionPermission =
  | { ok: true; level: CorrectionLevel }
  | { ok: false; reason: string };

type Membership = {
  branchId: string;
  enrolledByUserId: string;
  createdAt: Date | string;
};

type SessionUser = {
  id: string;
  role: Role;
  branchId: string | null;
};

function toDate(input: Date | string): Date {
  return typeof input === "string" ? new Date(input) : input;
}

function sameDayIST(a: Date, b: Date): boolean {
  const da = formatInTimeZone(a, IST, "yyyy-MM-dd");
  const db = formatInTimeZone(b, IST, "yyyy-MM-dd");
  return da === db;
}

/**
 * Source-of-truth gate for "can this user correct this membership right now?"
 * Used by both the UI (button visibility) and the server action (security gate).
 *
 * Permission matrix (since enrolment time):
 *
 *   < 60 min                — receptionist who enrolled it, manager same branch, owner
 *   same day, > 60 min      — manager same branch, owner
 *   < 90 days               — owner only
 *   > 90 days               — nobody (use refund + re-enroll)
 */
export function canCorrectMembership(
  user: SessionUser,
  membership: Membership,
  now: Date = new Date(),
): CorrectionPermission {
  const created = toDate(membership.createdAt);
  const minutesSinceCreation = (now.getTime() - created.getTime()) / 60_000;
  const daysSinceCreation = (now.getTime() - created.getTime()) / 86_400_000;
  const isSameDay = sameDayIST(now, created);

  if (user.role === "owner") {
    if (daysSinceCreation > OWNER_WINDOW_DAYS) {
      return {
        ok: false,
        reason: `Membership older than ${OWNER_WINDOW_DAYS} days. Use refund + re-enrol.`,
      };
    }
    return { ok: true, level: "owner" };
  }

  if (user.role === "branch_manager") {
    if (user.branchId !== membership.branchId) {
      return {
        ok: false,
        reason: "Membership is in a different branch.",
      };
    }
    if (!isSameDay) {
      return {
        ok: false,
        reason: "Membership not from today. Ask owner to correct.",
      };
    }
    return { ok: true, level: "manager" };
  }

  if (user.role === "receptionist") {
    if (membership.enrolledByUserId !== user.id) {
      return { ok: false, reason: "You did not enrol this member." };
    }
    if (minutesSinceCreation > RECEPTIONIST_WINDOW_MIN) {
      return {
        ok: false,
        reason: `Correction window (${RECEPTIONIST_WINDOW_MIN} min) has expired. Ask manager or owner.`,
      };
    }
    return { ok: true, level: "receptionist" };
  }

  return { ok: false, reason: "Insufficient permissions." };
}
