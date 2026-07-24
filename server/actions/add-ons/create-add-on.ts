"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { addOns, addOnCreateSchema, type AddOn } from "@/lib/db/schema/add-ons";
import { requireRole } from "@/lib/auth/get-session";
import { recordAudit } from "@/lib/auth/audit";
import { isUniqueViolation } from "@/lib/db/errors";

export type CreateAddOnResult =
  | { ok: true; data: AddOn }
  | { ok: false; error: string; code?: string };

export async function createAddOn(input: unknown): Promise<CreateAddOnResult> {
  const parsed = addOnCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid add-on",
      code: "validation",
    };
  }

  const session = await requireRole("owner", "branch_manager");

  try {
    const [row] = await db
      .insert(addOns)
      .values({ ...parsed.data, gymId: session.gym.id })
      .returning();

    await recordAudit({
      entityType: "addon",
      entityId: row.id,
      branchId: null,
      action: "create",
      after: row,
    });

    revalidatePath("/app/plans");
    return { ok: true, data: row };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return {
        ok: false,
        error: "An add-on with this name already exists.",
        code: "duplicate_name",
      };
    }
    console.error("createAddOn failed", err);
    return { ok: false, error: "Could not save add-on.", code: "internal" };
  }
}
