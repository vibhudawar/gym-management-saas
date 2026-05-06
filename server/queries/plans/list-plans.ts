import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/lib/db";
import { plans, type Plan } from "@/lib/db/schema/plans";
import { requireUser } from "@/lib/auth/get-session";

export type ListPlansOptions = {
  includeInactive?: boolean;
};

/**
 * Plans for the current user's gym, ordered active-first then by name.
 *
 * Wrapped in React `cache()` so any RSC tree that hits this query from
 * multiple components within the same render shares a single round-trip.
 * Note that `cache()` keys on argument identity — `listPlans()` dedups
 * across calls but `listPlans({ includeInactive: true })` evaluates a
 * fresh object each call site, so dedup only kicks in when the literal
 * argument is omitted.
 */
export const listPlans = cache(
  async (options: ListPlansOptions = {}): Promise<Plan[]> => {
    const session = await requireUser();
    const { includeInactive = false } = options;

    return db
      .select()
      .from(plans)
      .where(
        and(
          eq(plans.gymId, session.gym.id),
          isNull(plans.deletedAt),
          includeInactive ? undefined : eq(plans.isActive, true),
        ),
      )
      .orderBy(desc(plans.isActive), asc(plans.name));
  },
);
