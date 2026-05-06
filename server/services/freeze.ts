import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { freezes, type Freeze } from "@/lib/db/schema/freezes";
import { memberships } from "@/lib/db/schema/memberships";
import { recordAudit } from "@/lib/auth/audit";
import type { SessionContext } from "@/lib/auth/get-session";
import { MIN_REASON_CHARS } from "@/lib/constants/validation";
import {
  addDaysIso,
  daysBetweenInclusiveIso,
  todayIstIso,
} from "@/lib/utils/dates";

export type CreateFreezeInput = {
  membershipId: string;
  freezeStartDate: string; // YYYY-MM-DD
  freezeEndDate: string; // YYYY-MM-DD
  reason: string;
};

export type CreateFreezeErrorCode =
  | "MEMBERSHIP_NOT_FOUND"
  | "MEMBERSHIP_NOT_ACTIVE"
  | "INVALID_DATE"
  | "REASON_TOO_SHORT"
  | "FREEZE_OVERLAP"
  | "BRANCH_FORBIDDEN";

export type CreateFreezeResult =
  | {
      ok: true;
      freezeId: string;
      newMembershipEndDate: string;
    }
  | { ok: false; code: CreateFreezeErrorCode; message: string };

const MAX_REASON_CHARS = 500;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Freeze a membership for a date range. Locks the membership row, validates
 * dates + reason + non-overlap, inserts the freeze, extends the membership
 * end_date by exactly the inclusive span. Audit-logged. See § 6.6.
 */
export async function createFreezeService(
  session: SessionContext,
  input: CreateFreezeInput,
): Promise<CreateFreezeResult> {
  const reason = (input.reason ?? "").trim();
  if (reason.length < MIN_REASON_CHARS || reason.length > MAX_REASON_CHARS) {
    return {
      ok: false,
      code: "REASON_TOO_SHORT",
      message: `Reason must be ${MIN_REASON_CHARS}–${MAX_REASON_CHARS} characters.`,
    };
  }
  if (!ISO_DATE.test(input.freezeStartDate) || !ISO_DATE.test(input.freezeEndDate)) {
    return {
      ok: false,
      code: "INVALID_DATE",
      message: "Dates are invalid. Use YYYY-MM-DD.",
    };
  }
  if (input.freezeEndDate < input.freezeStartDate) {
    return {
      ok: false,
      code: "INVALID_DATE",
      message: "End date cannot be before start date.",
    };
  }
  const today = todayIstIso();
  if (input.freezeStartDate < today) {
    return {
      ok: false,
      code: "INVALID_DATE",
      message: "Freeze cannot start in the past.",
    };
  }

  type TxOk = {
    ok: true;
    freeze: Freeze;
    newEndDate: string;
  };
  type TxErr = { ok: false; code: CreateFreezeErrorCode; message: string };

  const result: TxOk | TxErr = await db.transaction(async (tx) => {
    const [membership] = await tx
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.id, input.membershipId),
          eq(memberships.gymId, session.gym.id),
          isNull(memberships.deletedAt),
        ),
      )
      .for("update")
      .limit(1);

    if (!membership) {
      return {
        ok: false,
        code: "MEMBERSHIP_NOT_FOUND",
        message: "Membership not found.",
      };
    }

    // Branch-manager defense in depth: must own the branch (RLS handles
    // SELECT but action-level INSERT+UPDATE checks need the explicit gate).
    if (
      session.user.role !== "owner" &&
      session.user.branchId &&
      membership.branchId !== session.user.branchId
    ) {
      return {
        ok: false,
        code: "BRANCH_FORBIDDEN",
        message: "Membership is in a different branch.",
      };
    }

    // Membership must currently be active (not cancelled, not expired,
    // not already frozen).
    if (membership.status === "cancelled") {
      return {
        ok: false,
        code: "MEMBERSHIP_NOT_ACTIVE",
        message: "Cannot freeze a cancelled membership.",
      };
    }
    if (membership.endDate < today) {
      return {
        ok: false,
        code: "MEMBERSHIP_NOT_ACTIVE",
        message: "Membership has already expired. Renew first.",
      };
    }
    if (input.freezeStartDate >= membership.endDate) {
      return {
        ok: false,
        code: "INVALID_DATE",
        message: "Freeze cannot start at or after the membership ends.",
      };
    }
    // Freeze end date may safely extend past the current membership end —
    // the membership.end_date will be pushed out by the freeze duration, so
    // there's no inconsistency. We only require start < current end so the
    // freeze actually pauses some remaining days.

    // Overlap check — block if any active or scheduled freeze covers any of
    // the proposed date range. `cancelled_early` and `completed` are ignored.
    const [overlap] = await tx.execute<{ exists: boolean }>(sql`
      select exists (
        select 1 from ${freezes}
        where membership_id = ${input.membershipId}
          and deleted_at is null
          and status in ('scheduled','active')
          and freeze_start_date <= ${input.freezeEndDate}::date
          and freeze_end_date >= ${input.freezeStartDate}::date
      ) as exists
    `);
    if (overlap?.exists) {
      return {
        ok: false,
        code: "FREEZE_OVERLAP",
        message: "Another freeze overlaps with these dates.",
      };
    }

    const daysAdded = daysBetweenInclusiveIso(
      input.freezeStartDate,
      input.freezeEndDate,
    );

    const initialStatus =
      input.freezeStartDate === today ? "active" : "scheduled";

    const [freeze] = await tx
      .insert(freezes)
      .values({
        gymId: session.gym.id,
        branchId: membership.branchId,
        membershipId: membership.id,
        memberId: membership.memberId,
        freezeStartDate: input.freezeStartDate,
        freezeEndDate: input.freezeEndDate,
        daysAdded,
        reason,
        status: initialStatus,
        createdByUserId: session.user.id,
      })
      .returning();

    const newEndDate = addDaysIso(membership.endDate, daysAdded);
    await tx
      .update(memberships)
      .set({ endDate: newEndDate, updatedAt: new Date() })
      .where(eq(memberships.id, membership.id));

    return { ok: true, freeze, newEndDate };
  });

  if (!result.ok) return result;

  await recordAudit({
    entityType: "freeze",
    entityId: result.freeze.id,
    branchId: result.freeze.branchId,
    action: "create",
    after: {
      ...result.freeze,
      _meta: {
        membershipId: result.freeze.membershipId,
        daysAdded: result.freeze.daysAdded,
        newMembershipEndDate: result.newEndDate,
      },
    },
  });

  return {
    ok: true,
    freezeId: result.freeze.id,
    newMembershipEndDate: result.newEndDate,
  };
}
