import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { freezes, type FreezeStatus } from "@/lib/db/schema/freezes";
import { requireUser } from "@/lib/auth/get-session";

export type CurrentFreeze = {
  id: string;
  freezeStartDate: string;
  freezeEndDate: string;
  daysAdded: number;
  reason: string;
  status: FreezeStatus;
  effectiveStatus: "scheduled" | "active";
};

const istToday = sql`((now() at time zone 'Asia/Kolkata')::date)`;

/**
 * The single active or upcoming-scheduled freeze for a membership, if any.
 * Returns null when the membership is unfrozen or its freezes are all
 * already completed / cancelled.
 *
 * Drives the "frozen" state of the Current Membership card and the
 * scheduled-freeze notice shown on the active card.
 */
export async function getCurrentFreeze(
  membershipId: string,
): Promise<CurrentFreeze | null> {
  const session = await requireUser();
  const [row] = await db
    .select({
      id: freezes.id,
      freezeStartDate: freezes.freezeStartDate,
      freezeEndDate: freezes.freezeEndDate,
      daysAdded: freezes.daysAdded,
      reason: freezes.reason,
      status: freezes.status,
      effectiveStatus: sql<"scheduled" | "active">`
        case
          when ${freezes.freezeStartDate} > ${istToday} then 'scheduled'
          else 'active'
        end
      `,
    })
    .from(freezes)
    .where(
      and(
        eq(freezes.membershipId, membershipId),
        eq(freezes.gymId, session.gym.id),
        isNull(freezes.deletedAt),
        sql`${freezes.status} <> 'cancelled_early'`,
        // Hasn't ended yet: end_date >= today.
        sql`${freezes.freezeEndDate} >= ${istToday}`,
      ),
    )
    .orderBy(freezes.freezeStartDate)
    .limit(1);

  return row ?? null;
}
