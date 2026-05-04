import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/get-session";

export type BranchActiveCounts = {
  members: number;
  staff: number;
};

/**
 * Counts non-deleted members + staff at a branch. Used by the branch
 * deactivation guard so the owner sees concrete numbers instead of a
 * generic block.
 */
export async function getBranchActiveCounts(
  branchId: string,
): Promise<BranchActiveCounts> {
  const session = await requireRole("owner");
  type Row = { members: number; staff: number };
  const rows = (await db.execute<Row>(sql`
    select
      (
        select count(*)::int from members
        where gym_id = ${session.gym.id}::uuid
          and branch_id = ${branchId}::uuid
          and deleted_at is null
      ) as members,
      (
        select count(*)::int from users
        where gym_id = ${session.gym.id}::uuid
          and branch_id = ${branchId}::uuid
          and deleted_at is null
          and is_active = true
      ) as staff
  `)) as unknown as Row[];
  return {
    members: rows[0] ? Number(rows[0].members) || 0 : 0,
    staff: rows[0] ? Number(rows[0].staff) || 0 : 0,
  };
}
