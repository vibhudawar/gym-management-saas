import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { addOns, type AddOn } from "@/lib/db/schema/add-ons";
import { requireUser } from "@/lib/auth/get-session";

export async function getAddOn(id: string): Promise<AddOn | null> {
  const session = await requireUser();
  const rows = await db
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
  return rows[0] ?? null;
}
