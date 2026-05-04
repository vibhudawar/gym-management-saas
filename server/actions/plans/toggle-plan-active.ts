"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { plans, type Plan } from "@/lib/db/schema/plans";
import { requireRole } from "@/lib/auth/get-session";
import { recordAudit } from "@/lib/auth/audit";

export type TogglePlanActiveResult =
  | { ok: true; data: Plan }
  | { ok: false; error: string; code?: string };

export async function togglePlanActive(
  id: string,
  active: boolean,
): Promise<TogglePlanActiveResult> {
  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Plan id is required.", code: "validation" };
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
    .from(plans)
    .where(
      and(
        eq(plans.id, id),
        eq(plans.gymId, session.gym.id),
        isNull(plans.deletedAt),
      ),
    )
    .limit(1);

  if (!before) {
    return { ok: false, error: "Plan not found.", code: "not_found" };
  }
  if (before.isActive === active) {
    return { ok: true, data: before };
  }

  const [after] = await db
    .update(plans)
    .set({ isActive: active, updatedAt: new Date() })
    .where(eq(plans.id, id))
    .returning();

  await recordAudit({
    entityType: "plan",
    entityId: after.id,
    branchId: null,
    action: "update",
    before,
    after,
  });

  revalidatePath("/plans");
  return { ok: true, data: after };
}
