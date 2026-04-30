"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { members, type Member } from "@/lib/db/schema/members";
import { recordAudit } from "@/lib/auth/audit";
import { requireRole } from "@/lib/auth/get-session";

export type SoftDeleteMemberResult =
  | { ok: true; data: Member }
  | { ok: false; error: string; code?: string };

export async function softDeleteMember(
  id: string,
  reason?: string,
): Promise<SoftDeleteMemberResult> {
  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Member id is required.", code: "validation" };
  }

  const session = await requireRole("owner", "branch_manager");
  const isOwner = session.user.role === "owner";

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

  if (!isOwner && session.branch && before.branchId !== session.branch.id) {
    return {
      ok: false,
      error: "You can only delete members in your own branch.",
      code: "branch_forbidden",
    };
  }

  // Module 04 will add an active-membership guard here; nothing to block on yet.

  const trimmedReason = typeof reason === "string" ? reason.trim() : "";
  const now = new Date();

  const [after] = await db
    .update(members)
    .set({ deletedAt: now, isActive: false })
    .where(eq(members.id, id))
    .returning();

  await recordAudit({
    entityType: "member",
    entityId: after.id,
    action: "delete",
    before,
    after: trimmedReason ? { ...after, deleteReason: trimmedReason } : after,
  });

  revalidatePath("/members");
  revalidatePath(`/members/${id}`);
  return { ok: true, data: after };
}
