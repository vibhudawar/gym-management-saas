import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { addOns } from "@/lib/db/schema/add-ons";
import { members } from "@/lib/db/schema/members";
import { membershipAddons } from "@/lib/db/schema/membership-addons";
import { memberships, type Membership } from "@/lib/db/schema/memberships";
import {
  payments,
  type Payment,
  type PaymentMode,
} from "@/lib/db/schema/payments";
import { plans } from "@/lib/db/schema/plans";
import { recordAudit } from "@/lib/auth/audit";
import type { SessionContext } from "@/lib/auth/get-session";
import type { Transaction } from "@/lib/db/types";
import { allocateInvoiceNumber } from "./invoice-numbering";

export type EnrollmentInput = {
  memberId: string;
  branchId: string;
  planId: string;
  startDate: string; // YYYY-MM-DD
  appliedAddOnIds: string[];
  discountPaise: number;
  discountReason: string | null;
  finalAmountPaise: number;
  paymentMode: PaymentMode;
  paymentDate: string; // YYYY-MM-DD
  paymentNotes: string | null;
  previousMembershipId?: string | null;
};

export type EnrollmentErrorCode =
  | "MEMBER_NOT_FOUND"
  | "INVALID_PLAN"
  | "INVALID_ADDON"
  | "ACTIVE_MEMBERSHIP_EXISTS"
  | "AMOUNT_MISMATCH"
  | "DISCOUNT_REASON_REQUIRED"
  | "DISCOUNT_TOO_LARGE"
  | "INVALID_START_DATE"
  | "INVALID_PAYMENT_DATE"
  | "BRANCH_FORBIDDEN";

export type EnrollmentError = {
  ok: false;
  code: EnrollmentErrorCode;
  message: string;
};

export type EnrollmentSuccess = {
  ok: true;
  membershipId: string;
  paymentId: string;
  invoiceNumber: string;
};

export type EnrollmentResult = EnrollmentSuccess | EnrollmentError;

/** Internal: success result that also carries rows for post-commit auditing. */
export type EnrollmentTxResult =
  | (EnrollmentSuccess & { membership: Membership; payment: Payment })
  | EnrollmentError;

const MAX_BACKDATE_DAYS = 30;

function parseIsoDate(input: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;
  const d = new Date(`${input}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDays(iso: string, days: number): string {
  const d = parseIsoDate(iso);
  if (!d) throw new Error(`bad date: ${iso}`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Pre-flight validation that doesn't need DB access. Use this before opening
 * a transaction so we can fail fast on bad input without acquiring locks.
 */
export function validateEnrollmentInput(
  session: SessionContext,
  input: EnrollmentInput,
): EnrollmentError | null {
  const isOwner = session.user.role === "owner";
  if (!isOwner && session.branch && input.branchId !== session.branch.id) {
    return {
      ok: false,
      code: "BRANCH_FORBIDDEN",
      message: "You can only enrol members in your own branch.",
    };
  }
  if (!parseIsoDate(input.startDate)) {
    return {
      ok: false,
      code: "INVALID_START_DATE",
      message: "Start date must be YYYY-MM-DD.",
    };
  }
  const paymentDate = parseIsoDate(input.paymentDate);
  if (!paymentDate) {
    return {
      ok: false,
      code: "INVALID_PAYMENT_DATE",
      message: "Payment date must be YYYY-MM-DD.",
    };
  }
  const todayDate = parseIsoDate(todayIso())!;
  const oldestAllowed = new Date(todayDate);
  oldestAllowed.setUTCDate(oldestAllowed.getUTCDate() - MAX_BACKDATE_DAYS);
  if (paymentDate < oldestAllowed || paymentDate > todayDate) {
    return {
      ok: false,
      code: "INVALID_PAYMENT_DATE",
      message: `Payment date must be within the last ${MAX_BACKDATE_DAYS} days and not in the future.`,
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
  return null;
}

/**
 * Transaction-aware enrolment core. Assumes pre-flight passed.
 * Returns rows for the caller to audit AFTER commit.
 *
 * Options.skipMemberCheck: set when the caller has just inserted the member in
 * the same transaction (i.e. createMemberAndEnroll); the member row exists but
 * a SELECT would still see it via repeatable-read since we're in the same tx.
 */
export async function enrollWithinTx(
  tx: Transaction,
  session: SessionContext,
  input: EnrollmentInput,
  options: { skipMemberCheck?: boolean } = {},
): Promise<EnrollmentTxResult> {
  const today = todayIso();

  if (!options.skipMemberCheck) {
    const [memberRow] = await tx
      .select({ id: members.id })
      .from(members)
      .where(
        and(
          eq(members.id, input.memberId),
          eq(members.gymId, session.gym.id),
          isNull(members.deletedAt),
        ),
      )
      .limit(1);
    if (!memberRow) {
      return {
        ok: false,
        code: "MEMBER_NOT_FOUND",
        message: "Member not found.",
      };
    }
  }

  // Lock all of this member's memberships and verify nothing active/frozen.
  const existing = await tx
    .select({
      id: memberships.id,
      status: memberships.status,
      endDate: memberships.endDate,
    })
    .from(memberships)
    .where(
      and(
        eq(memberships.memberId, input.memberId),
        isNull(memberships.deletedAt),
      ),
    )
    .for("update");

  const blocking = existing.find((m) => {
    if (m.status === "frozen") return true;
    if (m.status === "active") return m.endDate >= today;
    return false;
  });
  if (blocking) {
    return {
      ok: false,
      code: "ACTIVE_MEMBERSHIP_EXISTS",
      message:
        blocking.status === "frozen"
          ? "This member's membership is frozen. Unfreeze before enrolling."
          : `Member already has an active membership ending on ${blocking.endDate}.`,
    };
  }
  const overlapping = existing.find(
    (m) => m.status === "active" && m.endDate >= input.startDate,
  );
  if (overlapping) {
    return {
      ok: false,
      code: "INVALID_START_DATE",
      message: `Start date overlaps an existing membership ending ${overlapping.endDate}.`,
    };
  }

  // Validate plan.
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

  // Validate add-ons (snapshot prices).
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

  // Server-side amount recompute.
  const expected = planRow.defaultPricePaise + addonsTotal - input.discountPaise;
  if (expected !== input.finalAmountPaise) {
    return {
      ok: false,
      code: "AMOUNT_MISMATCH",
      message: "Pricing changed — refresh and try again.",
    };
  }
  if (expected < 0) {
    return {
      ok: false,
      code: "DISCOUNT_TOO_LARGE",
      message: "Discount exceeds the plan + add-ons total.",
    };
  }

  const endDate = addDays(input.startDate, planRow.durationDays);

  const [membershipRow] = await tx
    .insert(memberships)
    .values({
      gymId: session.gym.id,
      branchId: input.branchId,
      memberId: input.memberId,
      planId: input.planId,
      startDate: input.startDate,
      endDate,
      originalEndDate: endDate,
      planPricePaise: planRow.defaultPricePaise,
      addonsTotalPaise: addonsTotal,
      discountPaise: input.discountPaise,
      discountReason:
        input.discountPaise > 0 ? (input.discountReason ?? null) : null,
      finalAmountPaise: expected,
      status: "active",
      previousMembershipId: input.previousMembershipId ?? null,
      enrolledByUserId: session.user.id,
    })
    .returning();

  if (addonRows.length > 0) {
    await tx.insert(membershipAddons).values(
      addonRows.map((a) => ({
        membershipId: membershipRow.id,
        addOnId: a.id,
        amountPaise: a.amountPaise,
      })),
    );
  }

  const invoiceNumber = await allocateInvoiceNumber(
    tx,
    session.gym.id,
    parseIsoDate(input.paymentDate)!,
  );

  const [paymentRow] = await tx
    .insert(payments)
    .values({
      gymId: session.gym.id,
      branchId: input.branchId,
      membershipId: membershipRow.id,
      memberId: input.memberId,
      amountPaise: expected,
      paymentMode: input.paymentMode,
      paymentDate: input.paymentDate,
      invoiceNumber,
      kind: "payment",
      notes: input.paymentNotes,
      receivedByUserId: session.user.id,
    })
    .returning();

  return {
    ok: true,
    membershipId: membershipRow.id,
    paymentId: paymentRow.id,
    invoiceNumber,
    membership: membershipRow,
    payment: paymentRow,
  };
}

/** Audit a successful enrolment after the transaction has committed. */
export async function auditEnrollmentSuccess(
  result: EnrollmentSuccess & { membership: Membership; payment: Payment },
): Promise<void> {
  await recordAudit({
    entityType: "membership",
    entityId: result.membershipId,
    action: "create",
    after: result.membership,
  });
  await recordAudit({
    entityType: "payment",
    entityId: result.paymentId,
    action: "create",
    after: result.payment,
  });
}

/**
 * Public entry point: opens its own transaction, runs preflight, and audits.
 */
export async function enroll(
  session: SessionContext,
  input: EnrollmentInput,
): Promise<EnrollmentResult> {
  const preflightError = validateEnrollmentInput(session, input);
  if (preflightError) return preflightError;

  const result = await db.transaction((tx) =>
    enrollWithinTx(tx, session, input),
  );

  if (!result.ok) return result;
  await auditEnrollmentSuccess(result);
  return {
    ok: true,
    membershipId: result.membershipId,
    paymentId: result.paymentId,
    invoiceNumber: result.invoiceNumber,
  };
}
