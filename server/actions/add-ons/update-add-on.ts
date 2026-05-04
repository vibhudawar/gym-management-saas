"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { addOns, addOnUpdateSchema, type AddOn } from "@/lib/db/schema/add-ons";
import { requireRole } from "@/lib/auth/get-session";
import { recordAudit } from "@/lib/auth/audit";

export type UpdateAddOnResult =
  | { ok: true; data: AddOn }
  | { ok: false; error: string; code?: string };

export async function updateAddOn(
  id: string,
  input: unknown,
): Promise<UpdateAddOnResult> {
  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "Add-on id is required.", code: "validation" };
  }

  const parsed = addOnUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid add-on",
      code: "validation",
    };
  }
  if (Object.keys(parsed.data).length === 0) {
    return { ok: false, error: "No changes to save.", code: "no_changes" };
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

  try {
    const [after] = await db
      .update(addOns)
      .set({ ...parsed.data, updatedAt: new Date() })
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
  } catch (err) {
    if (isUniqueViolation(err)) {
      return {
        ok: false,
        error: "An add-on with this name already exists.",
        code: "duplicate_name",
      };
    }
    console.error("updateAddOn failed", err);
    return { ok: false, error: "Could not save add-on.", code: "internal" };
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
