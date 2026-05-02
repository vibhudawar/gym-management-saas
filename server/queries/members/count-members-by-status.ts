import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema/members";
import { requireUser } from "@/lib/auth/get-session";

export type MembershipStatusCounts = {
  total: number;
  active: number;
  expiring: number; // active and ending within 14 days
  expired: number;
  frozen: number;
  noMembership: number;
};

const EXPIRING_WINDOW_DAYS = 14;

const latestStatusSql = sql<string | null>`(
  select case
    when m.status = 'cancelled' then 'cancelled'
    when m.end_date < ((now() at time zone 'Asia/Kolkata')::date) then 'expired'
    when exists (
      select 1 from freezes f
      where f.membership_id = m.id
        and f.deleted_at is null
        and f.status <> 'cancelled_early'
        and f.freeze_start_date <= ((now() at time zone 'Asia/Kolkata')::date)
        and f.freeze_end_date >= ((now() at time zone 'Asia/Kolkata')::date)
    ) then 'frozen'
    else 'active'
  end
  from memberships m
  where m.member_id = ${members.id} and m.deleted_at is null
  order by m.start_date desc, m.created_at desc
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

  const conditions = [
    eq(members.gymId, session.gym.id),
    isNull(members.deletedAt),
  ];
  if (session.activeBranch) {
    conditions.push(eq(members.branchId, session.activeBranch.id));
  }
  if (branchId && branchId !== "all") {
    conditions.push(eq(members.branchId, branchId));
  }

  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${latestStatusSql} = 'active')::int`,
      expiring: sql<number>`count(*) filter (where ${latestStatusSql} = 'active' and ${latestEndDateSql}::date - ((now() at time zone 'Asia/Kolkata')::date) <= ${EXPIRING_WINDOW_DAYS})::int`,
      expired: sql<number>`count(*) filter (where ${latestStatusSql} = 'expired')::int`,
      frozen: sql<number>`count(*) filter (where ${latestStatusSql} = 'frozen')::int`,
      noMembership: sql<number>`count(*) filter (where ${latestStatusSql} is null)::int`,
    })
    .from(members)
    .where(and(...conditions));

  return {
    total: row?.total ?? 0,
    active: row?.active ?? 0,
    expiring: row?.expiring ?? 0,
    expired: row?.expired ?? 0,
    frozen: row?.frozen ?? 0,
    noMembership: row?.noMembership ?? 0,
  };
}
