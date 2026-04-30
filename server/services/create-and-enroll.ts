import { and, eq, isNull } from "drizzle-orm";
import { branches } from "@/lib/db/schema/branches";
import {
  members,
  type Member,
  type MemberCreateInput,
} from "@/lib/db/schema/members";
import { recordAudit } from "@/lib/auth/audit";
import type { SessionContext } from "@/lib/auth/get-session";
import { db } from "@/lib/db";
import {
  auditEnrollmentSuccess,
  enrollWithinTx,
  validateEnrollmentInput,
  type EnrollmentError,
  type EnrollmentInput,
} from "./enrollment";

export type CreateAndEnrollErrorCode =
  | "VALIDATION"
  | "BRANCH_FORBIDDEN"
  | "BRANCH_NOT_FOUND"
  | "DUPLICATE_PHONE"
  | "INTERNAL"
  | EnrollmentError["code"];

export type CreateAndEnrollResult =
  | {
      ok: true;
      memberId: string;
      enrolled: boolean;
      membershipId?: string;
      paymentId?: string;
      invoiceNumber?: string;
    }
  | {
      ok: false;
      code: CreateAndEnrollErrorCode;
      message: string;
      existing?: { id: string; name: string; branchName: string };
    };

type Input = {
  member: MemberCreateInput;
  enrollment?: Omit<EnrollmentInput, "memberId" | "branchId">;
};

/**
 * Atomically insert a member and optionally enrol them in their first plan.
 * Either both succeed or both roll back — no orphan member if the enrolment
 * step fails.
 */
export async function createMemberAndEnroll(
  session: SessionContext,
  input: Input,
): Promise<CreateAndEnrollResult> {
  const data = input.member;
  const isOwner = session.user.role === "owner";
  if (!isOwner && session.branch && data.branchId !== session.branch.id) {
    return {
      ok: false,
      code: "BRANCH_FORBIDDEN",
      message: "You can only add members to your own branch.",
    };
  }

  // Pre-flight enrolment validation (date formats etc) before we touch the DB.
  if (input.enrollment) {
    const enrollmentInput: EnrollmentInput = {
      ...input.enrollment,
      memberId: "_pending_",
      branchId: data.branchId,
    };
    const preflightError = validateEnrollmentInput(session, enrollmentInput);
    if (preflightError) return preflightError;
  }

  // Branch sanity check.
  const [branchRow] = await db
    .select({ id: branches.id, name: branches.name })
    .from(branches)
    .where(
      and(
        eq(branches.id, data.branchId),
        eq(branches.gymId, session.gym.id),
        isNull(branches.deletedAt),
      ),
    )
    .limit(1);
  if (!branchRow) {
    return {
      ok: false,
      code: "BRANCH_NOT_FOUND",
      message: "Branch not found.",
    };
  }

  // Duplicate-phone check (outside tx — read-only is fine).
  const [duplicate] = await db
    .select({
      id: members.id,
      name: members.name,
      branchName: branches.name,
    })
    .from(members)
    .innerJoin(branches, eq(branches.id, members.branchId))
    .where(
      and(
        eq(members.gymId, session.gym.id),
        eq(members.phone, data.phone),
        isNull(members.deletedAt),
      ),
    )
    .limit(1);
  if (duplicate) {
    return {
      ok: false,
      code: "DUPLICATE_PHONE",
      message: "A member with this phone already exists in your gym.",
      existing: {
        id: duplicate.id,
        name: duplicate.name,
        branchName: duplicate.branchName,
      },
    };
  }

  type TxSuccess =
    | {
        member: Member;
        enrolled: false;
      }
    | {
        member: Member;
        enrolled: true;
        enrollmentResult: Extract<
          Awaited<ReturnType<typeof enrollWithinTx>>,
          { ok: true }
        >;
      };

  let outcome: TxSuccess;

  try {
    outcome = await db.transaction(async (tx): Promise<TxSuccess> => {
      const [memberRow] = await tx
        .insert(members)
        .values({
          gymId: session.gym.id,
          branchId: data.branchId,
          name: data.name,
          phone: data.phone,
          email: data.email ?? null,
          gender: data.gender ?? null,
          dob: data.dob ?? null,
          address: data.address ?? null,
          emergencyContactName: data.emergencyContactName ?? null,
          emergencyContactPhone: data.emergencyContactPhone ?? null,
          notes: data.notes ?? null,
          joinedDate: data.joinedDate ?? new Date().toISOString().slice(0, 10),
          createdByUserId: session.user.id,
        })
        .returning();

      if (!input.enrollment) {
        return { member: memberRow, enrolled: false };
      }

      const enrollmentResult = await enrollWithinTx(
        tx,
        session,
        {
          ...input.enrollment,
          memberId: memberRow.id,
          branchId: data.branchId,
        },
        { skipMemberCheck: true },
      );

      if (!enrollmentResult.ok) {
        // Throw to roll back the inserted member; the catch below repacks the error.
        throw Object.assign(new Error(enrollmentResult.message), {
          enrollment: enrollmentResult,
        });
      }

      return {
        member: memberRow,
        enrolled: true,
        enrollmentResult,
      };
    });
  } catch (err) {
    if (err && typeof err === "object" && "enrollment" in err) {
      const e = (err as { enrollment: EnrollmentError }).enrollment;
      return e;
    }
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "23505"
    ) {
      return {
        ok: false,
        code: "DUPLICATE_PHONE",
        message: "A member with this phone already exists in your gym.",
      };
    }
    console.error("createMemberAndEnroll failed", err);
    return {
      ok: false,
      code: "INTERNAL",
      message: "Could not create member.",
    };
  }

  await recordAudit({
    entityType: "member",
    entityId: outcome.member.id,
    action: "create",
    after: outcome.member,
  });

  if (outcome.enrolled) {
    await auditEnrollmentSuccess(outcome.enrollmentResult);
    return {
      ok: true,
      memberId: outcome.member.id,
      enrolled: true,
      membershipId: outcome.enrollmentResult.membershipId,
      paymentId: outcome.enrollmentResult.paymentId,
      invoiceNumber: outcome.enrollmentResult.invoiceNumber,
    };
  }

  return {
    ok: true,
    memberId: outcome.member.id,
    enrolled: false,
  };
}
