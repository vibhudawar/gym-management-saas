"use server";

import { and, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { branches } from "@/lib/db/schema/branches";
import { ACTIVE_BRANCH_COOKIE, requireUser } from "@/lib/auth/get-session";

const inputSchema = z.object({
  branchId: z.string().uuid().nullable(),
});

type Result = { ok: true } | { ok: false; error: string; code?: string };

/**
 * Owner-only: set (or clear) the active-branch cookie that scopes data views.
 * Pass `null` to clear the override (= "All branches").
 */
export async function setActiveBranch(
  input: z.infer<typeof inputSchema>,
): Promise<Result> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "validation" };
  }

  const session = await requireUser();
  if (session.user.role !== "owner") {
    return { ok: false, error: "Only owners can switch branches.", code: "forbidden" };
  }

  const cookieStore = await cookies();

  if (parsed.data.branchId === null) {
    cookieStore.delete(ACTIVE_BRANCH_COOKIE);
    revalidatePath("/", "layout");
    return { ok: true };
  }

  const found = await db
    .select({ id: branches.id })
    .from(branches)
    .where(
      and(
        eq(branches.id, parsed.data.branchId),
        eq(branches.gymId, session.gym.id),
        eq(branches.isActive, true),
        isNull(branches.deletedAt),
      ),
    )
    .limit(1);

  if (found.length === 0) {
    return { ok: false, error: "Branch not found.", code: "not_found" };
  }

  cookieStore.set(ACTIVE_BRANCH_COOKIE, parsed.data.branchId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
