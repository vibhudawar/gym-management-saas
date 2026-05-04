"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { members, type Member } from "@/lib/db/schema/members";
import { memberships } from "@/lib/db/schema/memberships";
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

  // Block delete if there's an effectively-active or frozen membership.
  const [activeMembership] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.memberId, id),
        isNull(memberships.deletedAt),
        sql`(
          (${memberships.status} = 'active' and ${memberships.endDate} >= current_date)
          or ${memberships.status} = 'frozen'
        )`,
      ),
    )
    .limit(1);
  if (activeMembership) {
    return {
      ok: false,
      error:
        "This member has an active or frozen membership. End or cancel the membership before deleting.",
      code: "HAS_ACTIVE_MEMBERSHIP",
    };
  }

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
    branchId: after.branchId,
    action: "delete",
    before,
    after: trimmedReason ? { ...after, deleteReason: trimmedReason } : after,
  });

  revalidatePath("/members");
  revalidatePath(`/members/${id}`);
  return { ok: true, data: after };
}
