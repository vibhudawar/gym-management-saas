"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { addOns, type AddOn } from "@/lib/db/schema/add-ons";
import { requireRole } from "@/lib/auth/get-session";
import { recordAudit } from "@/lib/auth/audit";

export type ToggleAddOnActiveResult =
  | { ok: true; data: AddOn }
  | { ok: false; error: string; code?: string };

export async function toggleAddOnActive(
  id: string,
  active: boolean,
): Promise<ToggleAddOnActiveResult> {
  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Add-on id is required.", code: "validation" };
  }
  if (typeof active !== "boolean") {
    return {
      ok: false,
      error: "active must be true or false.",
      code: "validation",
    };
  }

  const session = await requireRole("owner", "branch_manager");

  const [before] = await db
    .select()
    .from(addOns)
    .where(
      and(
        eq(addOns.id, id),
        eq(addOns.gymId, session.gym.id),
        isNull(addOns.deletedAt),
      ),
    )
    .limit(1);

  if (!before) {
    return { ok: false, error: "Add-on not found.", code: "not_found" };
  }
  if (before.isActive === active) {
    return { ok: true, data: before };
  }

  const [after] = await db
    .update(addOns)
    .set({ isActive: active, updatedAt: new Date() })
    .where(eq(addOns.id, id))
    .returning();

  await recordAudit({
    entityType: "addon",
    entityId: after.id,
    branchId: null,
    action: "update",
    before,
    after,
  });

  revalidatePath("/plans");
  return { ok: true, data: after };
}
