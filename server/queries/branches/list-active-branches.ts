import { and, asc, eq, isNull } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/lib/db";
import { branches, type Branch } from "@/lib/db/schema/branches";
import { requireUser } from "@/lib/auth/get-session";

export type BranchSummary = Pick<Branch, "id" | "name">;

/**
 * Active, non-deleted branches the current user is allowed to see.
 * Owners → all branches in the gym; managers/receptionists → just their branch.
 *
 * Wrapped in React `cache()` so the (app) layout (sidebar) and any descendant
 * page that needs the same list share a single round-trip per request.
 */
export const listActiveBranches = cache(
  async (): Promise<BranchSummary[]> => {
    const session = await requireUser();
    const isOwner = session.user.role === "owner";

    const conditions = [
      eq(branches.gymId, session.gym.id),
      eq(branches.isActive, true),
      isNull(branches.deletedAt),
    ];
    if (!isOwner && session.branch) {
      conditions.push(eq(branches.id, session.branch.id));
    }

    return db
      .select({ id: branches.id, name: branches.name })
      .from(branches)
      .where(and(...conditions))
      .orderBy(asc(branches.name));
  },
);
