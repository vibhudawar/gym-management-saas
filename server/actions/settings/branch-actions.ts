"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { branches } from "@/lib/db/schema/branches";
import { recordAudit } from "@/lib/auth/audit";
import { requireRole } from "@/lib/auth/get-session";
import { normalizeIndianPhone } from "@/lib/utils/phone";
import { getBranchActiveCounts } from "@/server/queries/settings/get-branch-active-counts";

const createInputSchema = z.object({
  name: z.string().trim().min(2).max(60),
  address: z.string().trim().max(500).optional(),
  phone: z.string().trim().optional(),
});

const updateInputSchema = z.object({
  branchId: z.string().uuid(),
  name: z.string().trim().min(2).max(60),
  address: z.string().trim().max(500).optional(),
  phone: z.string().trim().optional(),
});

type Result = { ok: true } | { ok: false; error: string; code?: string };

function normalisePhoneOrError(phone?: string):
  | { ok: true; phone: string | null }
  | { ok: false; error: string } {
  if (!phone || phone.trim().length === 0) return { ok: true, phone: null };
  const normalised = normalizeIndianPhone(phone);
  if (!normalised) {
    return { ok: false, error: "Phone number must be a valid Indian mobile." };
  }
  return { ok: true, phone: normalised };
}

export async function createBranchAction(input: unknown): Promise<Result> {
  const parsed = createInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const session = await requireRole("owner");
  const phone = normalisePhoneOrError(parsed.data.phone);
  if (!phone.ok) return phone;

  const [created] = await db
    .insert(branches)
    .values({
      gymId: session.gym.id,
      name: parsed.data.name,
      address: parsed.data.address || null,
      phone: phone.phone,
    })
    .returning();

  await recordAudit({
    entityType: "branch",
    entityId: created.id,
    branchId: created.id,
    action: "create",
    after: created,
  });
  revalidatePath("/settings/branches");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateBranchAction(input: unknown): Promise<Result> {
  const parsed = updateInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const session = await requireRole("owner");
  const phone = normalisePhoneOrError(parsed.data.phone);
  if (!phone.ok) return phone;

  const [before] = await db
    .select()
    .from(branches)
    .where(
      and(eq(branches.id, parsed.data.branchId), eq(branches.gymId, session.gym.id)),
    )
    .limit(1);
  if (!before) return { ok: false, error: "Branch not found." };

  const [after] = await db
    .update(branches)
    .set({
      name: parsed.data.name,
      address: parsed.data.address || null,
      phone: phone.phone,
    })
    .where(eq(branches.id, before.id))
    .returning();

  await recordAudit({
    entityType: "branch",
    entityId: after.id,
    branchId: after.id,
    action: "update",
    before,
    after,
  });
  // Rename only — the branch dropdown reads names from the cached session
  // which refreshes on next nav. No layout-tree revalidate needed for this
  // path. Create / deactivate / reactivate keep theirs because those
  // membership changes affect the dropdown contents.
  revalidatePath("/settings/branches");
  return { ok: true };
}

type DeactivateResult =
  | { ok: true }
  | {
      ok: false;
      code: "HAS_ACTIVE_MEMBERS_OR_STAFF" | "LAST_ACTIVE_BRANCH" | "NOT_FOUND";
      error: string;
      counts?: { members: number; staff: number };
    };

export async function deactivateBranchAction(
  input: unknown,
): Promise<DeactivateResult> {
  const parsed = z.object({ branchId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "NOT_FOUND", error: "Invalid input." };
  }
  const session = await requireRole("owner");

  const [branch] = await db
    .select()
    .from(branches)
    .where(
      and(eq(branches.id, parsed.data.branchId), eq(branches.gymId, session.gym.id)),
    )
    .limit(1);
  if (!branch) {
    return { ok: false, code: "NOT_FOUND", error: "Branch not found." };
  }

  // Last-active-branch guard.
  const [{ value: activeCount }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(branches)
    .where(
      and(
        eq(branches.gymId, session.gym.id),
        eq(branches.isActive, true),
        isNull(branches.deletedAt),
      ),
    );
  if (activeCount <= 1) {
    return {
      ok: false,
      code: "LAST_ACTIVE_BRANCH",
      error:
        "Cannot deactivate your only branch. Add another branch first if you're consolidating.",
    };
  }

  // Active members / staff guard.
  const counts = await getBranchActiveCounts(branch.id);
  if (counts.members > 0 || counts.staff > 0) {
    return {
      ok: false,
      code: "HAS_ACTIVE_MEMBERS_OR_STAFF",
      error: `This branch has ${counts.members} active members and ${counts.staff} active staff. Move them to another branch first.`,
      counts,
    };
  }

  const [after] = await db
    .update(branches)
    .set({ isActive: false, deletedAt: new Date() })
    .where(eq(branches.id, branch.id))
    .returning();

  await recordAudit({
    entityType: "branch",
    entityId: after.id,
    branchId: after.id,
    action: "delete",
    before: branch,
    after,
  });
  revalidatePath("/settings/branches");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function reactivateBranchAction(input: unknown): Promise<Result> {
  const parsed = z.object({ branchId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const session = await requireRole("owner");

  const [before] = await db
    .select()
    .from(branches)
    .where(
      and(eq(branches.id, parsed.data.branchId), eq(branches.gymId, session.gym.id)),
    )
    .limit(1);
  if (!before) return { ok: false, error: "Branch not found." };

  const [after] = await db
    .update(branches)
    .set({ isActive: true, deletedAt: null })
    .where(eq(branches.id, before.id))
    .returning();

  await recordAudit({
    entityType: "branch",
    entityId: after.id,
    branchId: after.id,
    action: "update",
    before,
    after: { ...after, _meta: { event: "reactivated" } },
  });
  revalidatePath("/settings/branches");
  revalidatePath("/", "layout");
  return { ok: true };
}
