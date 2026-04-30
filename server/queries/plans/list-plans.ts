import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { plans, type Plan } from "@/lib/db/schema/plans";
import { requireUser } from "@/lib/auth/get-session";

export type ListPlansOptions = {
  includeInactive?: boolean;
};

export async function listPlans(
  options: ListPlansOptions = {},
): Promise<Plan[]> {
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
}
