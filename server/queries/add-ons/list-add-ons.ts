import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { addOns, type AddOn } from "@/lib/db/schema/add-ons";
import { requireUser } from "@/lib/auth/get-session";

export type ListAddOnsOptions = {
  includeInactive?: boolean;
};

export async function listAddOns(
  options: ListAddOnsOptions = {},
): Promise<AddOn[]> {
  const session = await requireUser();
  const { includeInactive = false } = options;

  return db
    .select()
    .from(addOns)
    .where(
      and(
        eq(addOns.gymId, session.gym.id),
        isNull(addOns.deletedAt),
        includeInactive ? undefined : eq(addOns.isActive, true),
      ),
    )
    .orderBy(desc(addOns.isActive), asc(addOns.name));
}
