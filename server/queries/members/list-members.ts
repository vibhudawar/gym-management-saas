import { and, asc, desc, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { branches } from "@/lib/db/schema/branches";
import { members, type Member } from "@/lib/db/schema/members";
import { requireUser } from "@/lib/auth/get-session";

export type ListMembersInput = {
  search?: string;
  branchId?: string;
  status?: "active" | "deleted";
  sortBy?: "name" | "joined_date" | "created_at";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type MemberListRow = Member & { branchName: string };

export type ListMembersResult = {
  rows: MemberListRow[];
  total: number;
  page: number;
  pageSize: number;
};

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export async function listMembers(
  input: ListMembersInput = {},
): Promise<ListMembersResult> {
  const session = await requireUser();
  const isOwner = session.user.role === "owner";

  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, input.pageSize ?? DEFAULT_PAGE_SIZE),
  );

  const conditions = [eq(members.gymId, session.gym.id)];

  if (!isOwner && session.branch) {
    conditions.push(eq(members.branchId, session.branch.id));
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
    const searchClause = or(
      ilike(members.name, pattern),
      ilike(members.phone, pattern),
    );
    if (searchClause) conditions.push(searchClause);
  }

  const where = and(...conditions);

  const sortBy = input.sortBy ?? "name";
  const sortDir = input.sortDir ?? "asc";
  const sortColumn =
    sortBy === "joined_date"
      ? members.joinedDate
      : sortBy === "created_at"
        ? members.createdAt
        : members.name;
  const order = sortDir === "desc" ? desc(sortColumn) : asc(sortColumn);

  const offset = (page - 1) * pageSize;

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        member: members,
        branchName: branches.name,
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
    rows: rows.map((r) => ({ ...r.member, branchName: r.branchName })),
    total: totalRow[0]?.count ?? 0,
    page,
    pageSize,
  };
}
