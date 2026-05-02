import { and, asc, desc, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { branches } from "@/lib/db/schema/branches";
import { members, type Member } from "@/lib/db/schema/members";
import type { MembershipStatus } from "@/lib/db/schema/memberships";
import { requireUser } from "@/lib/auth/get-session";

export type MemberStatusFilter =
  | "all"
  | "active"
  | "expiring"
  | "expired"
  | "frozen"
  | "no_membership";

export type ListMembersInput = {
  search?: string;
  branchId?: string;
  status?: "active" | "deleted";
  membershipStatus?: MemberStatusFilter;
  sortBy?: "name" | "joined_date" | "created_at" | "membership";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type MemberListRow = Member & {
  branchName: string;
  latestMembershipStatus: MembershipStatus | null;
  latestMembershipEndDate: string | null;
  latestPlanName: string | null;
};

export type ListMembersResult = {
  rows: MemberListRow[];
  total: number;
  page: number;
  pageSize: number;
};

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

const EXPIRING_WINDOW_DAYS = 14;

// Scalar subqueries for the most-recent (live) membership of each member.
// Each returns null for members with no membership history.

const latestStatusSql = sql<MembershipStatus | null>`(
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

const latestPlanNameSql = sql<string | null>`(
  select p.name
  from memberships m
  left join plans p on p.id = m.plan_id
  where m.member_id = ${members.id} and m.deleted_at is null
  order by m.start_date desc, m.created_at desc
  limit 1
)`;

export async function listMembers(
  input: ListMembersInput = {},
): Promise<ListMembersResult> {
  const session = await requireUser();

  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, input.pageSize ?? DEFAULT_PAGE_SIZE),
  );

  const conditions = [eq(members.gymId, session.gym.id)];

  if (session.activeBranch) {
    conditions.push(eq(members.branchId, session.activeBranch.id));
  }
  if (input.branchId && input.branchId !== "all") {
    conditions.push(eq(members.branchId, input.branchId));
  }
  if (input.status === "deleted") {
    conditions.push(isNotNull(members.deletedAt));
  } else {
    conditions.push(isNull(members.deletedAt));
  }

  const search = input.search?.trim();
  if (search && search.length >= 2) {
    const pattern = `%${search}%`;
    const clause = or(
      ilike(members.name, pattern),
      ilike(members.phone, pattern),
    );
    if (clause) conditions.push(clause);
  }

  // Membership-status filter applied at SQL level so pagination + counts stay accurate.
  switch (input.membershipStatus) {
    case "active":
      conditions.push(sql`${latestStatusSql} = 'active'`);
      break;
    case "expired":
      conditions.push(sql`${latestStatusSql} = 'expired'`);
      break;
    case "expiring":
      conditions.push(sql`${latestStatusSql} = 'active'`);
      conditions.push(
        sql`${latestEndDateSql}::date - ((now() at time zone 'Asia/Kolkata')::date) <= ${EXPIRING_WINDOW_DAYS}`,
      );
      break;
    case "frozen":
      conditions.push(sql`${latestStatusSql} = 'frozen'`);
      break;
    case "no_membership":
      conditions.push(sql`${latestStatusSql} is null`);
      break;
    case "all":
    case undefined:
      break;
  }

  const where = and(...conditions);

  const sortBy = input.sortBy ?? "name";
  const sortDir = input.sortDir ?? "asc";

  let order;
  if (sortBy === "membership") {
    const priority = sql`case
      when ${latestStatusSql} = 'active' and ${latestEndDateSql}::date - ((now() at time zone 'Asia/Kolkata')::date) <= ${EXPIRING_WINDOW_DAYS} then 1
      when ${latestStatusSql} = 'active' then 2
      when ${latestStatusSql} = 'expired' then 3
      when ${latestStatusSql} = 'frozen' then 4
      when ${latestStatusSql} = 'cancelled' then 5
      else 6
    end`;
    order = sortDir === "desc" ? desc(priority) : asc(priority);
  } else {
    const sortColumn =
      sortBy === "joined_date"
        ? members.joinedDate
        : sortBy === "created_at"
          ? members.createdAt
          : members.name;
    order = sortDir === "desc" ? desc(sortColumn) : asc(sortColumn);
  }

  const offset = (page - 1) * pageSize;

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        member: members,
        branchName: branches.name,
        latestMembershipStatus: latestStatusSql,
        latestMembershipEndDate: latestEndDateSql,
        latestPlanName: latestPlanNameSql,
      })
      .from(members)
      .innerJoin(branches, eq(branches.id, members.branchId))
      .where(where)
      .orderBy(order)
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(members)
      .where(where),
  ]);

  return {
    rows: rows.map((r) => ({
      ...r.member,
      branchName: r.branchName,
      latestMembershipStatus: r.latestMembershipStatus,
      latestMembershipEndDate: r.latestMembershipEndDate,
      latestPlanName: r.latestPlanName,
    })),
    total: totalRow[0]?.count ?? 0,
    page,
    pageSize,
  };
}
