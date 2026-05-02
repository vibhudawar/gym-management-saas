import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { addOns } from "@/lib/db/schema/add-ons";
import { freezes } from "@/lib/db/schema/freezes";
import { membershipAddons } from "@/lib/db/schema/membership-addons";
import {
  memberships,
  type Membership,
} from "@/lib/db/schema/memberships";
import {
  payments,
  type Payment,
  type PaymentMode,
} from "@/lib/db/schema/payments";
import { plans } from "@/lib/db/schema/plans";
import { recordAudit } from "@/lib/auth/audit";
import type { SessionContext } from "@/lib/auth/get-session";
import {
  canCorrectMembership,
  type CorrectionLevel,
} from "@/lib/auth/membership-permissions";

export type CorrectMembershipInput = {
  membershipId: string;
  planId: string;
  appliedAddOnIds: string[];
  discountPaise: number;
  discountReason: string | null;
  paymentMode: PaymentMode;
  reason: string;
};

export type CorrectMembershipErrorCode =
  | "MEMBERSHIP_NOT_FOUND"
  | "PERMISSION_DENIED"
  | "PAYMENT_NOT_FOUND"
  | "INVALID_PLAN"
  | "INVALID_ADDON"
  | "DISCOUNT_REASON_REQUIRED"
  | "DISCOUNT_TOO_LARGE"
  | "REASON_TOO_SHORT";

export type CorrectMembershipResult =
  | { ok: true; membershipId: string; paymentId: string }
  | { ok: false; code: CorrectMembershipErrorCode; message: string };

const MIN_REASON_CHARS = 10;

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function correctMembershipService(
  session: SessionContext,
  input: CorrectMembershipInput,
): Promise<CorrectMembershipResult> {
  const reason = (input.reason ?? "").trim();
  if (reason.length < MIN_REASON_CHARS) {
    return {
      ok: false,
      code: "REASON_TOO_SHORT",
      message: `Reason must be at least ${MIN_REASON_CHARS} characters.`,
    };
  }

  if (input.discountPaise < 0) {
    return {
      ok: false,
      code: "DISCOUNT_TOO_LARGE",
      message: "Discount cannot be negative.",
    };
  }
  if (
    input.discountPaise > 0 &&
    (!input.discountReason || input.discountReason.trim().length < 3)
  ) {
    return {
      ok: false,
      code: "DISCOUNT_REASON_REQUIRED",
      message: "Reason is required when applying a discount.",
    };
  }

  type TxResult =
    | { ok: true; level: CorrectionLevel; before: AuditSnapshot; after: AuditSnapshot }
    | { ok: false; code: CorrectMembershipErrorCode; message: string };

  const result: TxResult = await db.transaction(async (tx) => {
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

    const permission = canCorrectMembership(
      {
        id: session.user.id,
        role: session.user.role,
        branchId: session.user.branchId ?? null,
      },
      before,
    );
    if (!permission.ok) {
      return {
        ok: false,
        code: "PERMISSION_DENIED",
        message: permission.reason,
      };
    }

    const [paymentBefore] = await tx
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.membershipId, before.id),
          eq(payments.kind, "payment"),
          isNull(payments.deletedAt),
        ),
      )
      .for("update")
      .limit(1);
    if (!paymentBefore) {
      return {
        ok: false,
        code: "PAYMENT_NOT_FOUND",
        message: "Could not find the linked payment to correct.",
      };
    }

    const beforeAddons = await tx
      .select({
        addOnId: membershipAddons.addOnId,
        amountPaise: membershipAddons.amountPaise,
      })
      .from(membershipAddons)
      .where(eq(membershipAddons.membershipId, before.id));

    const [planRow] = await tx
      .select()
      .from(plans)
      .where(
        and(
          eq(plans.id, input.planId),
          eq(plans.gymId, session.gym.id),
          isNull(plans.deletedAt),
        ),
      )
      .limit(1);
    if (!planRow || !planRow.isActive) {
      return {
        ok: false,
        code: "INVALID_PLAN",
        message: "Plan is unavailable.",
      };
    }

    let addonsTotal = 0;
    const addonRows: { id: string; amountPaise: number }[] = [];
    if (input.appliedAddOnIds.length > 0) {
      const fetched = await tx
        .select({
          id: addOns.id,
          amountPaise: addOns.amountPaise,
          isActive: addOns.isActive,
        })
        .from(addOns)
        .where(
          and(
            eq(addOns.gymId, session.gym.id),
            inArray(addOns.id, input.appliedAddOnIds),
            isNull(addOns.deletedAt),
          ),
        );
      if (fetched.length !== input.appliedAddOnIds.length) {
        return {
          ok: false,
          code: "INVALID_ADDON",
          message: "One or more add-ons are unavailable.",
        };
      }
      for (const a of fetched) {
        if (!a.isActive) {
          return {
            ok: false,
            code: "INVALID_ADDON",
            message: "An inactive add-on was selected.",
          };
        }
        addonsTotal += a.amountPaise;
        addonRows.push({ id: a.id, amountPaise: a.amountPaise });
      }
    }

    const finalAmount =
      planRow.defaultPricePaise + addonsTotal - input.discountPaise;
    if (finalAmount < 0) {
      return {
        ok: false,
        code: "DISCOUNT_TOO_LARGE",
        message: "Discount exceeds the plan + add-ons total.",
      };
    }

    // end_date recomputed from start_date + new plan's duration. original_end_date NEVER changes.
    // Existing freezes have already been applied to the OLD end_date — we
    // re-apply their day extensions on top of the new plan duration so the
    // member doesn't lose the days they've already been promised.
    const [{ frozen_days: frozenDays }] = (await tx.execute<{
      frozen_days: number;
    }>(sql`
      select coalesce(sum(${freezes.daysAdded}), 0)::int as frozen_days
      from ${freezes}
      where ${freezes.membershipId} = ${before.id}
        and ${freezes.deletedAt} is null
        and ${freezes.status} <> 'cancelled_early'
    `)) as unknown as Array<{ frozen_days: number }>;
    const newEndDate = addDays(
      before.startDate,
      planRow.durationDays + Number(frozenDays ?? 0),
    );

    const now = new Date();
    const [after] = await tx
      .update(memberships)
      .set({
        planId: input.planId,
        endDate: newEndDate,
        planPricePaise: planRow.defaultPricePaise,
        addonsTotalPaise: addonsTotal,
        discountPaise: input.discountPaise,
        discountReason:
          input.discountPaise > 0 ? (input.discountReason ?? null) : null,
        finalAmountPaise: finalAmount,
        correctedAt: now,
        correctedByUserId: session.user.id,
        correctionCount: before.correctionCount + 1,
      })
      .where(eq(memberships.id, before.id))
      .returning();

    // Replace add-on snapshots.
    await tx
      .delete(membershipAddons)
      .where(eq(membershipAddons.membershipId, before.id));
    if (addonRows.length > 0) {
      await tx.insert(membershipAddons).values(
        addonRows.map((a) => ({
          membershipId: before.id,
          addOnId: a.id,
          amountPaise: a.amountPaise,
        })),
      );
    }

    const [paymentAfter] = await tx
      .update(payments)
      .set({
        amountPaise: finalAmount,
        paymentMode: input.paymentMode,
        correctedAt: now,
        correctedByUserId: session.user.id,
        correctionCount: paymentBefore.correctionCount + 1,
      })
      .where(eq(payments.id, paymentBefore.id))
      .returning();

    return {
      ok: true,
      level: permission.level,
      before: {
        membership: before,
        addons: beforeAddons,
        payment: paymentBefore,
      },
      after: {
        membership: after,
        addons: addonRows.map((a) => ({
          addOnId: a.id,
          amountPaise: a.amountPaise,
        })),
        payment: paymentAfter,
      },
    };
  });

  if (!result.ok) return result;

  await recordAudit({
    entityType: "membership",
    entityId: result.after.membership.id,
    action: "correction",
    before: result.before,
    after: {
      ...result.after,
      _meta: { level: result.level, reason },
    },
  });
  await recordAudit({
    entityType: "payment",
    entityId: result.after.payment.id,
    action: "correction",
    before: result.before.payment,
    after: {
      ...result.after.payment,
      _meta: { level: result.level, reason, kind: "membership_correction" },
    },
  });

  return {
    ok: true,
    membershipId: result.after.membership.id,
    paymentId: result.after.payment.id,
  };

  // Inline type so the closure result above is well-typed.
  type AuditSnapshot = {
    membership: Membership;
    addons: { addOnId: string; amountPaise: number }[];
    payment: Payment;
  };
  // (sql is imported but unused intentionally — left for future extensions.)
  void sql;
}
