import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { memberships } from "@/lib/db/schema/memberships";
import { recordAudit } from "@/lib/auth/audit";
import type { SessionContext } from "@/lib/auth/get-session";
import { MIN_REASON_CHARS } from "@/lib/constants/validation";
import { todayIstIso } from "@/lib/utils/dates";
import {
  recordRefundService,
  type RefundResult,
} from "./refund";
import { notifyCancellation } from "./notification-helpers";
import { endActiveFreezesForCancellation } from "./unfreeze";
import type { PaymentMode } from "@/lib/db/schema/payments";

export type CancelMembershipInput = {
  membershipId: string;
  effectiveDate: string; // YYYY-MM-DD
  reason: string;
  refund?: {
    paymentId: string;
    amountPaise: number; // positive
    paymentMode: PaymentMode;
    notes?: string | null;
  };
};

export type CancelMembershipErrorCode =
  | "MEMBERSHIP_NOT_FOUND"
  | "INVALID_STATE"
  | "INVALID_DATE"
  | "REASON_TOO_SHORT";

export type CancelMembershipResult =
  | {
      ok: true;
      membershipId: string;
      refund?: RefundResult;
    }
  | { ok: false; code: CancelMembershipErrorCode; message: string };

export async function cancelMembershipService(
  session: SessionContext,
  input: CancelMembershipInput,
): Promise<CancelMembershipResult> {
  const reason = (input.reason ?? "").trim();
  if (reason.length < MIN_REASON_CHARS) {
    return {
      ok: false,
      code: "REASON_TOO_SHORT",
      message: `Reason must be at least ${MIN_REASON_CHARS} characters.`,
    };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveDate)) {
    return {
      ok: false,
      code: "INVALID_DATE",
      message: "Effective date is invalid.",
    };
  }

  const today = todayIstIso();
  if (input.effectiveDate > today) {
    return {
      ok: false,
      code: "INVALID_DATE",
      message: "Effective date cannot be in the future.",
    };
  }

  type TxOk = {
    ok: true;
    membership: typeof memberships.$inferSelect;
    before: typeof memberships.$inferSelect;
  };
  type TxErr = { ok: false; code: CancelMembershipErrorCode; message: string };
  const result: TxOk | TxErr = await db.transaction(async (tx) => {
    const [before] = await tx
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
    if (!before) {
      return {
        ok: false,
        code: "MEMBERSHIP_NOT_FOUND",
        message: "Membership not found.",
      };
    }

    if (before.status !== "active" && before.status !== "frozen") {
      return {
        ok: false,
        code: "INVALID_STATE",
        message: "Only active or frozen memberships can be cancelled.",
      };
    }
    if (input.effectiveDate < before.startDate) {
      return {
        ok: false,
        code: "INVALID_DATE",
        message: "Effective date cannot be before the membership started.",
      };
    }

    // End any open freezes before flipping to cancelled. The freezes' status
    // becomes 'cancelled_early' with an auto-synthesized reason; we don't
    // restore extension days here since the membership end_date is being
    // overwritten anyway.
    await endActiveFreezesForCancellation(
      tx as unknown as typeof db,
      {
        gymId: session.gym.id,
        membershipId: before.id,
        userId: session.user.id,
        cancellationReason: reason,
        cancellationDate: input.effectiveDate,
      },
    );

    const [after] = await tx
      .update(memberships)
      .set({
        status: "cancelled",
        endDate: input.effectiveDate,
        cancellationReason: reason,
      })
      .where(eq(memberships.id, before.id))
      .returning();

    return { ok: true, membership: after, before };
  });

  if (!result.ok) return result;

  await recordAudit({
    entityType: "membership",
    entityId: result.membership.id,
    branchId: result.membership.branchId,
    action: "cancel",
    before: result.before,
    after: {
      ...result.membership,
      _meta: { reason, effectiveDate: input.effectiveDate },
    },
  });

  let refundResult: RefundResult | undefined;
  if (input.refund) {
    refundResult = await recordRefundService(session, {
      paymentId: input.refund.paymentId,
      amountPaise: input.refund.amountPaise,
      paymentMode: input.refund.paymentMode,
      reason: `Cancellation refund — ${reason}`,
      refundDate: input.effectiveDate,
      // Cancellation receipt covers it — see § 11.6.
      suppressNotification: true,
    });
  }

  // Single combined receipt — if a refund was issued as part of the cancellation
  // we mention it in the same message rather than firing two.
  void notifyCancellation(result.membership, {
    effectiveDate: input.effectiveDate,
    refundAmountPaise: input.refund?.amountPaise ?? null,
  });

  return {
    ok: true,
    membershipId: result.membership.id,
    refund: refundResult,
  };
}
