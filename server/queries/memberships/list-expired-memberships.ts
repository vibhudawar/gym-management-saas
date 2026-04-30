import { and, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema/members";
import { memberships } from "@/lib/db/schema/memberships";
import { plans } from "@/lib/db/schema/plans";
import { requireUser } from "@/lib/auth/get-session";

export type ExpiredMembership = {
  membershipId: string;
  memberId: string;
  memberName: string;
  memberPhone: string;
  branchId: string;
  planName: string;
  endDate: string;
  finalAmountPaise: number;
};

export type ListExpiredInput = {
  daysSinceExpiry: number;
  branchId?: string;
};

export async function listExpiredMemberships(
  input: ListExpiredInput,
): Promise<ExpiredMembership[]> {
  const session = await requireUser();
  const isOwner = session.user.role === "owner";

  const conditions = [
    eq(memberships.gymId, session.gym.id),
    eq(memberships.status, "active"),
    isNull(memberships.deletedAt),
    lt(memberships.endDate, sql`current_date`),
    gte(
      memberships.endDate,
      sql`current_date - (${input.daysSinceExpiry} || ' days')::interval`,
    ),
  ];
  if (!isOwner && session.branch) {
    conditions.push(eq(memberships.branchId, session.branch.id));
  }
  if (input.branchId && input.branchId !== "all") {
    conditions.push(eq(memberships.branchId, input.branchId));
  }

  return db
    .select({
      membershipId: memberships.id,
      memberId: members.id,
      memberName: members.name,
      memberPhone: members.phone,
      branchId: memberships.branchId,
      planName: plans.name,
      endDate: memberships.endDate,
      finalAmountPaise: memberships.finalAmountPaise,
    })
    .from(memberships)
    .innerJoin(members, eq(members.id, memberships.memberId))
    .innerJoin(plans, eq(plans.id, memberships.planId))
    .where(and(...conditions))
    .orderBy(desc(memberships.endDate));
}
