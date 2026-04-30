"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { plans, planUpdateSchema, type Plan } from "@/lib/db/schema/plans";
import { requireRole } from "@/lib/auth/get-session";
import { recordAudit } from "@/lib/auth/audit";

export type UpdatePlanResult =
  | { ok: true; data: Plan }
  | { ok: false; error: string; code?: string };

export async function updatePlan(
  id: string,
  input: unknown,
): Promise<UpdatePlanResult> {
  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Plan id is required.", code: "validation" };
  }

  const parsed = planUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid plan",
      code: "validation",
    };
  }
  if (Object.keys(parsed.data).length === 0) {
    return { ok: false, error: "No changes to save.", code: "no_changes" };
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

  try {
    const [after] = await db
      .update(plans)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(plans.id, id))
      .returning();

    await recordAudit({
      entityType: "plan",
      entityId: after.id,
      action: "update",
      before,
      after,
    });

    revalidatePath("/plans");
    return { ok: true, data: after };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return {
        ok: false,
        error: "A plan with this name already exists.",
        code: "duplicate_name",
      };
    }
    console.error("updatePlan failed", err);
    return { ok: false, error: "Could not save plan.", code: "internal" };
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
