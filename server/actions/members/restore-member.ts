"use server";

import { and, eq, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { members, type Member } from "@/lib/db/schema/members";
import { recordAudit } from "@/lib/auth/audit";
import { requireRole } from "@/lib/auth/get-session";
import { isUniqueViolation } from "@/lib/db/errors";

export type RestoreMemberResult =
  | { ok: true; data: Member }
  | { ok: false; error: string; code?: string };

export async function restoreMember(id: string): Promise<RestoreMemberResult> {
  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Member id is required.", code: "validation" };
  }

  const session = await requireRole("owner");

  const [before] = await db
    .select()
    .from(members)
    .where(
      and(
        eq(members.id, id),
        eq(members.gymId, session.gym.id),
        isNotNull(members.deletedAt),
      ),
    )
    .limit(1);

  if (!before) {
    return { ok: false, error: "Member not found.", code: "not_found" };
  }

  // The unique-partial index on (gym_id, phone) WHERE deleted_at IS NULL will
  // reject the restore if a live member already holds this phone — handled by
  // the 23505 catch below.
  try {
    const [after] = await db
      .update(members)
      .set({ deletedAt: null, isActive: true })
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

    revalidatePath("/app/members");
    revalidatePath(`/app/members/${id}`);
    return { ok: true, data: after };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return {
        ok: false,
        error:
          "Cannot restore — another member is already using this phone number. Update one of the records first.",
        code: "duplicate_phone",
      };
    }
    console.error("restoreMember failed", err);
    return { ok: false, error: "Could not restore member.", code: "internal" };
  }
}
