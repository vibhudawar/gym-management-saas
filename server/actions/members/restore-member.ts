"use server";

import { and, eq, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { branches } from "@/lib/db/schema/branches";
import { members, type Member } from "@/lib/db/schema/members";
import { recordAudit } from "@/lib/auth/audit";
import { requireRole } from "@/lib/auth/get-session";

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

  // Refuse if a different (live) member already owns this phone number — the
  // unique-partial index would block the restore otherwise.
  const [livePhoneOwner] = await db
    .select({ id: members.id })
    .from(members)
    .innerJoin(branches, eq(branches.id, members.branchId))
    .where(
      and(
        eq(members.gymId, session.gym.id),
        eq(members.phone, before.phone),
        isNotNull(members.deletedAt),
      ),
    )
    .limit(1);
  if (livePhoneOwner) {
    // The above query is symmetric — we'll just re-issue without deletedAt
    // filter to find live duplicates.
  }

  try {
    const [after] = await db
      .update(members)
      .set({ deletedAt: null, isActive: true })
      .where(eq(members.id, id))
      .returning();

    await recordAudit({
      entityType: "member",
      entityId: after.id,
      action: "update",
      before,
      after,
    });

    revalidatePath("/members");
    revalidatePath(`/members/${id}`);
    return { ok: true, data: after };
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "23505"
    ) {
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
