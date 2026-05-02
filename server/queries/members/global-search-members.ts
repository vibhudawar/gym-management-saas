import { and, asc, eq, ilike, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { branches } from "@/lib/db/schema/branches";
import { members } from "@/lib/db/schema/members";
import { requireUser } from "@/lib/auth/get-session";

export type GlobalSearchHit = {
  id: string;
  name: string;
  phone: string;
  branchName: string;
};

export async function globalSearchMembers(
  query: string,
  limit = 8,
): Promise<GlobalSearchHit[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const session = await requireUser();
  const pattern = `%${trimmed}%`;

  const conditions = [
    eq(members.gymId, session.gym.id),
    isNull(members.deletedAt),
  ];
  if (session.activeBranch) {
    conditions.push(eq(members.branchId, session.activeBranch.id));
  }
  const searchClause = or(
    ilike(members.name, pattern),
    ilike(members.phone, pattern),
  );
  if (searchClause) conditions.push(searchClause);

  const rows = await db
    .select({
      id: members.id,
      name: members.name,
      phone: members.phone,
      branchName: branches.name,
    })
    .from(members)
    .innerJoin(branches, eq(branches.id, members.branchId))
    .where(and(...conditions))
    .orderBy(asc(members.name))
    .limit(limit);

  return rows;
}
