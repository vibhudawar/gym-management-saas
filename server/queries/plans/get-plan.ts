import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { plans, type Plan } from "@/lib/db/schema/plans";
import { requireUser } from "@/lib/auth/get-session";

export async function getPlan(id: string): Promise<Plan | null> {
  const session = await requireUser();
  const rows = await db
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
  return rows[0] ?? null;
}
