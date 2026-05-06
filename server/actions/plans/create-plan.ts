"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { plans, planCreateSchema, type Plan } from "@/lib/db/schema/plans";
import { requireRole } from "@/lib/auth/get-session";
import { recordAudit } from "@/lib/auth/audit";
import { isUniqueViolation } from "@/lib/db/errors";

export type CreatePlanResult =
  | { ok: true; data: Plan }
  | { ok: false; error: string; code?: string };

export async function createPlan(input: unknown): Promise<CreatePlanResult> {
  const parsed = planCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid plan",
      code: "validation",
    };
  }

  const session = await requireRole("owner", "branch_manager");

  try {
    const [row] = await db
      .insert(plans)
      .values({ ...parsed.data, gymId: session.gym.id })
      .returning();

    await recordAudit({
      entityType: "plan",
      entityId: row.id,
      branchId: null, // plan is gym-level
      action: "create",
      after: row,
    });

    revalidatePath("/plans");
    return { ok: true, data: row };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return {
        ok: false,
        error: "A plan with this name already exists.",
        code: "duplicate_name",
      };
    }
    console.error("createPlan failed", err);
    return { ok: false, error: "Could not save plan.", code: "internal" };
  }
}
