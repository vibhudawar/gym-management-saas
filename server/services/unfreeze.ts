import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { freezes, type Freeze } from "@/lib/db/schema/freezes";
import { memberships } from "@/lib/db/schema/memberships";
import { recordAudit } from "@/lib/auth/audit";
import type { SessionContext } from "@/lib/auth/get-session";

export type UnfreezeEarlyInput = {
  freezeId: string;
  unfreezeDate: string; // YYYY-MM-DD; the day the member returns
  earlyUnfreezeReason: string;
};

export type UnfreezeEarlyErrorCode =
  | "FREEZE_NOT_FOUND"
  | "FREEZE_NOT_ACTIVE"
  | "INVALID_DATE"
  | "REASON_TOO_SHORT"
  | "BRANCH_FORBIDDEN";

export type UnfreezeEarlyResult =
  | {
      ok: true;
      membershipId: string;
      newMembershipEndDate: string;
      daysSubtracted: number;
    }
  | { ok: false; code: UnfreezeEarlyErrorCode; message: string };

const MIN_REASON_CHARS = 10;
const MAX_REASON_CHARS = 500;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function todayIstIso(): string {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  )
    .toISOString()
    .slice(0, 10);
}

function daysBetweenInclusive(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * End a freeze before its scheduled end. Subtracts the unused days from the
 * membership's end_date, sets `actual_end_date = unfreeze_date - 1` (the
 * freeze ended *yesterday* if the member returns today), and revises
 * `freezes.days_added` to reflect what was actually applied. Audit-logged.
 *
 * Read § 6.5 + Pitfall #2 for the off-by-one semantics.
 */
export async function unfreezeEarlyService(
  session: SessionContext,
  input: UnfreezeEarlyInput,
): Promise<UnfreezeEarlyResult> {
  const reason = (input.earlyUnfreezeReason ?? "").trim();
  if (reason.length < MIN_REASON_CHARS || reason.length > MAX_REASON_CHARS) {
    return {
      ok: false,
      code: "REASON_TOO_SHORT",
      message: `Reason must be ${MIN_REASON_CHARS}–${MAX_REASON_CHARS} characters.`,
    };
  }
  if (!ISO_DATE.test(input.unfreezeDate)) {
    return {
      ok: false,
      code: "INVALID_DATE",
      message: "Unfreeze date is invalid.",
    };
  }
  const today = todayIstIso();
  if (input.unfreezeDate < today) {
    return {
      ok: false,
      code: "INVALID_DATE",
      message: "Cannot unfreeze in the past.",
    };
  }

  type TxOk = {
    ok: true;
    before: Freeze;
    after: Freeze;
    membershipId: string;
    newEndDate: string;
    daysSubtracted: number;
  };
  type TxErr = { ok: false; code: UnfreezeEarlyErrorCode; message: string };

  const result: TxOk | TxErr = await db.transaction(async (tx) => {
    const [freeze] = await tx
      .select()
      .from(freezes)
      .where(
        and(
          eq(freezes.id, input.freezeId),
          eq(freezes.gymId, session.gym.id),
          isNull(freezes.deletedAt),
        ),
      )
      .for("update")
      .limit(1);

    if (!freeze) {
      return {
        ok: false,
        code: "FREEZE_NOT_FOUND",
        message: "Freeze not found.",
      };
    }

    if (
      session.user.role !== "owner" &&
      session.user.branchId &&
      freeze.branchId !== session.user.branchId
    ) {
      return {
        ok: false,
        code: "BRANCH_FORBIDDEN",
        message: "Freeze is in a different branch.",
      };
    }

    // Only scheduled or active freezes can be cancelled early. Already
    // cancelled or naturally completed freezes are immutable.
    if (freeze.status === "cancelled_early") {
      return {
        ok: false,
        code: "FREEZE_NOT_ACTIVE",
        message: "Freeze has already been cancelled.",
      };
    }
    if (freeze.freezeEndDate < today) {
      return {
        ok: false,
        code: "FREEZE_NOT_ACTIVE",
        message: "Freeze has already completed naturally.",
      };
    }

    if (input.unfreezeDate < freeze.freezeStartDate) {
      return {
        ok: false,
        code: "INVALID_DATE",
        message: "Cannot unfreeze before the freeze even started.",
      };
    }
    if (input.unfreezeDate > freeze.freezeEndDate) {
      return {
        ok: false,
        code: "INVALID_DATE",
        message: "Use the natural end — this freeze is already past its end date.",
      };
    }

    // Off-by-one: returning today means the freeze ended yesterday. If the
    // member returns on the very first day of the freeze, actualEndDate sits
    // *before* freezeStartDate and zero days were used.
    const actualEndDate = addDaysIso(input.unfreezeDate, -1);
    const actualDaysUsed =
      actualEndDate < freeze.freezeStartDate
        ? 0
        : daysBetweenInclusive(freeze.freezeStartDate, actualEndDate);
    const daysToSubtract = freeze.daysAdded - actualDaysUsed;

    // Pull the membership for the end_date update, lock so a concurrent
    // freeze write doesn't race us.
    const [membership] = await tx
      .select()
      .from(memberships)
      .where(eq(memberships.id, freeze.membershipId))
      .for("update")
      .limit(1);
    if (!membership) {
      return {
        ok: false,
        code: "FREEZE_NOT_FOUND",
        message: "Linked membership is missing.",
      };
    }

    const newEndDate = addDaysIso(membership.endDate, -daysToSubtract);
    await tx
      .update(memberships)
      .set({ endDate: newEndDate, updatedAt: new Date() })
      .where(eq(memberships.id, membership.id));

    // For a freeze cancelled before its start day, actualEndDate falls
    // before freeze_start_date — but the DB constraint requires
    // actual_end_date >= freeze_start_date. Pin to freeze_start_date in
    // that edge case while keeping daysAdded at 0 to preserve the
    // mathematical truth that no extension was applied.
    const storedActualEndDate =
      actualEndDate < freeze.freezeStartDate
        ? freeze.freezeStartDate
        : actualEndDate;

    const [after] = await tx
      .update(freezes)
      .set({
        status: "cancelled_early",
        actualEndDate: storedActualEndDate,
        daysAdded: actualDaysUsed,
        endedByUserId: session.user.id,
        earlyUnfreezeReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(freezes.id, freeze.id))
      .returning();

    return {
      ok: true,
      before: freeze,
      after,
      membershipId: membership.id,
      newEndDate,
      daysSubtracted: daysToSubtract,
    };
  });

  if (!result.ok) return result;

  await recordAudit({
    entityType: "freeze",
    entityId: result.after.id,
    action: "cancel_early",
    before: result.before,
    after: {
      ...result.after,
      _meta: {
        earlyUnfreezeReason: reason,
        daysSubtracted: result.daysSubtracted,
        newMembershipEndDate: result.newEndDate,
      },
    },
  });

  return {
    ok: true,
    membershipId: result.membershipId,
    newMembershipEndDate: result.newEndDate,
    daysSubtracted: result.daysSubtracted,
  };
}

/**
 * Internal helper: end any active/scheduled freezes for a membership before a
 * cross-flow event (e.g., cancellation). Different from the user-facing early
 * unfreeze in that it doesn't require an explicit reason from the caller —
 * we synthesize one — and doesn't restore days to the membership end_date
 * (the caller is about to overwrite end_date anyway).
 *
 * Returns the IDs of freezes that were ended so the caller can audit them.
 */
export async function endActiveFreezesForCancellation(
  tx: typeof db,
  options: {
    gymId: string;
    membershipId: string;
    userId: string;
    cancellationReason: string;
    cancellationDate: string; // YYYY-MM-DD
  },
): Promise<Freeze[]> {
  const today = todayIstIso();
  const rows = await tx
    .select()
    .from(freezes)
    .where(
      and(
        eq(freezes.membershipId, options.membershipId),
        eq(freezes.gymId, options.gymId),
        isNull(freezes.deletedAt),
        sql`${freezes.status} in ('scheduled','active')`,
      ),
    )
    .for("update");

  const ended: Freeze[] = [];
  for (const f of rows) {
    const cutoff = options.cancellationDate < today ? today : options.cancellationDate;
    const actualEndDate = addDaysIso(cutoff, -1);
    const [after] = await tx
      .update(freezes)
      .set({
        status: "cancelled_early",
        actualEndDate:
          actualEndDate < f.freezeStartDate ? f.freezeStartDate : actualEndDate,
        endedByUserId: options.userId,
        earlyUnfreezeReason: `Membership cancelled — ${options.cancellationReason}`.slice(
          0,
          500,
        ),
        updatedAt: new Date(),
      })
      .where(eq(freezes.id, f.id))
      .returning();
    ended.push(after);
  }
  return ended;
}
