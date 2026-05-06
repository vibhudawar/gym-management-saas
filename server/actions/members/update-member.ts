"use server";

import { and, eq, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { branches } from "@/lib/db/schema/branches";
import { members, memberUpdateSchema, type Member } from "@/lib/db/schema/members";
import { recordAudit } from "@/lib/auth/audit";
import { requireUser } from "@/lib/auth/get-session";
import { isUniqueViolation } from "@/lib/db/errors";

export type UpdateMemberResult =
  | { ok: true; data: Member }
  | {
      ok: false;
      error: string;
      code?: string;
      existing?: { id: string; name: string; branchName: string };
    };

export async function updateMember(
  id: string,
  input: unknown,
): Promise<UpdateMemberResult> {
  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Member id is required.", code: "validation" };
  }

  const parsed = memberUpdateSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue?.message ?? "Invalid member",
      code: "validation",
    };
  }
  if (Object.keys(parsed.data).length === 0) {
    return { ok: false, error: "No changes to save.", code: "no_changes" };
  }

  const session = await requireUser();
  const data = parsed.data;

  const [before] = await db
    .select()
    .from(members)
    .where(
      and(
        eq(members.id, id),
        eq(members.gymId, session.gym.id),
        isNull(members.deletedAt),
      ),
    )
    .limit(1);

  if (!before) {
    return { ok: false, error: "Member not found.", code: "not_found" };
  }

  const isOwner = session.user.role === "owner";
  if (!isOwner && session.branch && before.branchId !== session.branch.id) {
    return {
      ok: false,
      error: "You can't edit members in another branch.",
      code: "branch_forbidden",
    };
  }

  if (data.branchId && data.branchId !== before.branchId) {
    if (!isOwner) {
      return {
        ok: false,
        error: "Only owners can move a member to a different branch.",
        code: "branch_forbidden",
      };
    }
    const [branchRow] = await db
      .select({ id: branches.id })
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
        error: "Branch not found.",
        code: "branch_not_found",
      };
    }
  }

  if (data.phone && data.phone !== before.phone) {
    const [duplicate] = await db
      .select({ id: members.id, name: members.name, branchName: branches.name })
      .from(members)
      .innerJoin(branches, eq(branches.id, members.branchId))
      .where(
        and(
          eq(members.gymId, session.gym.id),
          eq(members.phone, data.phone),
          isNull(members.deletedAt),
          ne(members.id, id),
        ),
      )
      .limit(1);
    if (duplicate) {
      return {
        ok: false,
        error: "Another member with this phone already exists.",
        code: "duplicate_phone",
        existing: {
          id: duplicate.id,
          name: duplicate.name,
          branchName: duplicate.branchName,
        },
      };
    }
  }

  try {
    const [after] = await db
      .update(members)
      .set({
        ...(data.branchId !== undefined && { branchId: data.branchId }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.email !== undefined && { email: data.email ?? null }),
        ...(data.gender !== undefined && { gender: data.gender ?? null }),
        ...(data.dob !== undefined && { dob: data.dob ?? null }),
        ...(data.address !== undefined && { address: data.address ?? null }),
        ...(data.emergencyContactName !== undefined && {
          emergencyContactName: data.emergencyContactName ?? null,
        }),
        ...(data.emergencyContactPhone !== undefined && {
          emergencyContactPhone: data.emergencyContactPhone ?? null,
        }),
        ...(data.notes !== undefined && { notes: data.notes ?? null }),
        ...(data.joinedDate !== undefined && { joinedDate: data.joinedDate }),
      })
      .where(eq(members.id, id))
      .returning();

    await recordAudit({
      entityType: "member",
      entityId: after.id,
      branchId: after.branchId,
      action: "update",
      before,
      after,
    });

    revalidatePath("/members");
    revalidatePath(`/members/${id}`);
    return { ok: true, data: after };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return {
        ok: false,
        error: "Another member with this phone already exists.",
        code: "duplicate_phone",
      };
    }
    console.error("updateMember failed", err);
    return { ok: false, error: "Could not update member.", code: "internal" };
  }
}
