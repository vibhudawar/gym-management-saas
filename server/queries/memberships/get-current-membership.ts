import { aliasedTable, and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { addOns } from "@/lib/db/schema/add-ons";
import { membershipAddons } from "@/lib/db/schema/membership-addons";
import { memberships, type MembershipStatus } from "@/lib/db/schema/memberships";
import { plans } from "@/lib/db/schema/plans";
import { users } from "@/lib/db/schema/users";
import { effectiveStatusSql } from "@/lib/db/sql/effective-status";
import { requireUser } from "@/lib/auth/get-session";

export type CurrentMembership = {
  id: string;
  planName: string;
  planType: string;
  startDate: string;
  endDate: string;
  createdAt: Date;
  enrolledByUserId: string;
  branchId: string;
  finalAmountPaise: number;
  planPricePaise: number;
  addonsTotalPaise: number;
  discountPaise: number;
  discountReason: string | null;
  effectiveStatus: MembershipStatus;
  planId: string;
  correctedAt: Date | null;
  correctedByName: string | null;
  correctionCount: number;
  cancellationReason: string | null;
  addOns: { addOnId: string; name: string; amountPaise: number }[];
};

/**
 * Returns the most-recent membership for this member. The "current" notion in
 * v1 is "the most recent non-deleted row" because we forbid concurrent active
 * memberships. The card UI uses `effectiveStatus` to decide what to render.
 */
export async function getCurrentMembership(
  memberId: string,
): Promise<CurrentMembership | null> {
  const session = await requireUser();
  const correctedByUsers = aliasedTable(users, "corrected_by_users");
  const [row] = await db
    .select({
      id: memberships.id,
      planId: plans.id,
      planName: plans.name,
      planType: plans.type,
      startDate: memberships.startDate,
      endDate: memberships.endDate,
      createdAt: memberships.createdAt,
      enrolledByUserId: memberships.enrolledByUserId,
      branchId: memberships.branchId,
      finalAmountPaise: memberships.finalAmountPaise,
      planPricePaise: memberships.planPricePaise,
      addonsTotalPaise: memberships.addonsTotalPaise,
      discountPaise: memberships.discountPaise,
      discountReason: memberships.discountReason,
      effectiveStatus: effectiveStatusSql,
      correctedAt: memberships.correctedAt,
      correctedByName: correctedByUsers.name,
      correctionCount: memberships.correctionCount,
      cancellationReason: memberships.cancellationReason,
    })
    .from(memberships)
    .innerJoin(plans, eq(plans.id, memberships.planId))
    .leftJoin(
      correctedByUsers,
      eq(correctedByUsers.id, memberships.correctedByUserId),
    )
    .where(
      and(
        eq(memberships.memberId, memberId),
        eq(memberships.gymId, session.gym.id),
        isNull(memberships.deletedAt),
      ),
    )
    .orderBy(desc(memberships.startDate))
    .limit(1);
  if (!row) return null;

  const lineItems = await db
    .select({
      addOnId: addOns.id,
      name: addOns.name,
      amountPaise: membershipAddons.amountPaise,
    })
    .from(membershipAddons)
    .innerJoin(addOns, eq(addOns.id, membershipAddons.addOnId))
    .where(eq(membershipAddons.membershipId, row.id));

  return { ...row, addOns: lineItems };
}
