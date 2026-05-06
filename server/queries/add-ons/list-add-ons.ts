import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/lib/db";
import { addOns, type AddOn } from "@/lib/db/schema/add-ons";
import { requireUser } from "@/lib/auth/get-session";

export type ListAddOnsOptions = {
  includeInactive?: boolean;
};

/**
 * Add-ons for the current user's gym, ordered active-first then by name.
 * See `listPlans` for the `cache()` keying nuance.
 */
export const listAddOns = cache(
  async (options: ListAddOnsOptions = {}): Promise<AddOn[]> => {
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
  },
);
