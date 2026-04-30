import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema/members";
import { requireUser } from "@/lib/auth/get-session";

export type MembershipStatusCounts = {
  total: number;
  active: number;
  expiring: number; // active and ending within 14 days
  expired: number;
  noMembership: number;
};

const EXPIRING_WINDOW_DAYS = 14;

const latestStatusSql = sql<string | null>`(
  select case
    when status = 'cancelled' then 'cancelled'
    when status = 'frozen' then 'frozen'
    when end_date < current_date then 'expired'
    else 'active'
  end
  from memberships
  where member_id = ${members.id} and deleted_at is null
  order by start_date desc, created_at desc
  limit 1
)`;

const latestEndDateSql = sql<string | null>`(
  select end_date::text
  from memberships
  where member_id = ${members.id} and deleted_at is null
  order by start_date desc, created_at desc
  limit 1
)`;

/**
 * Counts members by their latest membership's effective status. Branch-scoped
 * for non-owners; gym-wide for owners.
 */
export async function countMembersByStatus(
  branchId?: string,
): Promise<MembershipStatusCounts> {
  const session = await requireUser();
  const isOwner = session.user.role === "owner";

  const conditions = [
    eq(members.gymId, session.gym.id),
    isNull(members.deletedAt),
  ];
  if (!isOwner && session.branch) {
    conditions.push(eq(members.branchId, session.branch.id));
  }
  if (branchId && branchId !== "all") {
    conditions.push(eq(members.branchId, branchId));
  }

  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${latestStatusSql} = 'active')::int`,
      expiring: sql<number>`count(*) filter (where ${latestStatusSql} = 'active' and ${latestEndDateSql}::date - current_date <= ${EXPIRING_WINDOW_DAYS})::int`,
      expired: sql<number>`count(*) filter (where ${latestStatusSql} = 'expired')::int`,
      noMembership: sql<number>`count(*) filter (where ${latestStatusSql} is null)::int`,
    })
    .from(members)
    .where(and(...conditions));

  return {
    total: row?.total ?? 0,
    active: row?.active ?? 0,
    expiring: row?.expiring ?? 0,
    expired: row?.expired ?? 0,
    noMembership: row?.noMembership ?? 0,
  };
}
