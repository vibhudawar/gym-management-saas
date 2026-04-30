import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { memberships, type MembershipStatus } from "@/lib/db/schema/memberships";
import { plans } from "@/lib/db/schema/plans";
import { effectiveStatusSql } from "@/lib/db/sql/effective-status";
import { requireUser } from "@/lib/auth/get-session";

export type MembershipHistoryRow = {
  id: string;
  planName: string;
  startDate: string;
  endDate: string;
  finalAmountPaise: number;
  effectiveStatus: MembershipStatus;
};

export async function getMembershipHistory(
  memberId: string,
): Promise<MembershipHistoryRow[]> {
  const session = await requireUser();
  return db
    .select({
      id: memberships.id,
      planName: plans.name,
      startDate: memberships.startDate,
      endDate: memberships.endDate,
      finalAmountPaise: memberships.finalAmountPaise,
      effectiveStatus: effectiveStatusSql,
    })
    .from(memberships)
    .innerJoin(plans, eq(plans.id, memberships.planId))
    .where(
      and(
        eq(memberships.memberId, memberId),
        eq(memberships.gymId, session.gym.id),
        isNull(memberships.deletedAt),
      ),
    )
    .orderBy(desc(memberships.startDate));
}
