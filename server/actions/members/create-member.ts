"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { branches } from "@/lib/db/schema/branches";
import { members, memberCreateSchema, type Member } from "@/lib/db/schema/members";
import { recordAudit } from "@/lib/auth/audit";
import { requireUser } from "@/lib/auth/get-session";
import { and, eq, isNull } from "drizzle-orm";

export type CreateMemberResult =
  | { ok: true; data: Member }
  | { ok: false; error: string; code?: string; existing?: { id: string; name: string; branchName: string } };

export async function createMember(input: unknown): Promise<CreateMemberResult> {
  const parsed = memberCreateSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue?.message ?? "Invalid member",
      code: "validation",
    };
  }

  const session = await requireUser();
  const data = parsed.data;

  const isOwner = session.user.role === "owner";
  if (!isOwner && session.branch && data.branchId !== session.branch.id) {
    return {
      ok: false,
      error: "You can only add members to your own branch.",
      code: "branch_forbidden",
    };
  }

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
      error: "Branch not found.",
      code: "branch_not_found",
    };
  }

  const [duplicate] = await db
    .select({ id: members.id, name: members.name, branchName: branches.name })
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
      error: "A member with this phone already exists in your gym.",
      code: "duplicate_phone",
      existing: {
        id: duplicate.id,
        name: duplicate.name,
        branchName: duplicate.branchName,
      },
    };
  }

  try {
    const row = await db.transaction(async (tx) => {
      const [inserted] = await tx
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
      return inserted;
    });

    await recordAudit({
      entityType: "member",
      entityId: row.id,
      action: "create",
      after: row,
    });

    revalidatePath("/members");
    return { ok: true, data: row };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return {
        ok: false,
        error: "A member with this phone already exists in your gym.",
        code: "duplicate_phone",
      };
    }
    console.error("createMember failed", err);
    return { ok: false, error: "Could not create member.", code: "internal" };
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "23505"
  );
}
