import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { branches } from "@/lib/db/schema/branches";
import { members } from "@/lib/db/schema/members";
import { requireUser } from "@/lib/auth/get-session";

export type DuplicateMatch = {
  id: string;
  name: string;
  branchName: string;
  joinedDate: string;
};

/**
 * Returns the existing member with this E.164 phone in the current user's gym,
 * or null. Skips soft-deleted rows.
 */
export async function findByPhoneInGym(
  phone: string,
): Promise<DuplicateMatch | null> {
  const session = await requireUser();
  const rows = await db
    .select({
      id: members.id,
      name: members.name,
      branchName: branches.name,
      joinedDate: members.joinedDate,
    })
    .from(members)
    .innerJoin(branches, eq(branches.id, members.branchId))
    .where(
      and(
        eq(members.gymId, session.gym.id),
        eq(members.phone, phone),
        isNull(members.deletedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}
