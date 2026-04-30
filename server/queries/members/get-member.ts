import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { branches } from "@/lib/db/schema/branches";
import { members, type Member } from "@/lib/db/schema/members";
import { requireUser } from "@/lib/auth/get-session";

export type MemberDetail = Member & { branchName: string };

export async function getMember(id: string): Promise<MemberDetail | null> {
  const session = await requireUser();
  const rows = await db
    .select({ member: members, branchName: branches.name })
    .from(members)
    .innerJoin(branches, eq(branches.id, members.branchId))
    .where(and(eq(members.id, id), eq(members.gymId, session.gym.id)))
    .limit(1);
  if (rows.length === 0) return null;
  return { ...rows[0].member, branchName: rows[0].branchName };
}
