import { aliasedTable, and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { freezes, type FreezeStatus } from "@/lib/db/schema/freezes";
import { users } from "@/lib/db/schema/users";
import { requireUser } from "@/lib/auth/get-session";

export type FreezeHistoryRow = {
  id: string;
  freezeStartDate: string;
  freezeEndDate: string;
  actualEndDate: string | null;
  daysAdded: number;
  reason: string;
  status: FreezeStatus;
  effectiveStatus: FreezeStatus;
  createdByName: string | null;
  endedByName: string | null;
  earlyUnfreezeReason: string | null;
  createdAt: Date;
};

const istToday = sql`((now() at time zone 'Asia/Kolkata')::date)`;

const effectiveStatusSql = sql<FreezeStatus>`
  case
    when ${freezes.status} = 'cancelled_early' then 'cancelled_early'
    when ${freezes.freezeStartDate} > ${istToday} then 'scheduled'
    when ${freezes.freezeEndDate} < ${istToday} then 'completed'
    else 'active'
  end
`;

/**
 * All non-deleted freezes for a membership, newest first. Used by the
 * Freeze history card on member detail.
 */
export async function getFreezesByMembership(
  membershipId: string,
): Promise<FreezeHistoryRow[]> {
  const session = await requireUser();
  const createdBy = aliasedTable(users, "freeze_created_by");
  const endedBy = aliasedTable(users, "freeze_ended_by");

  const rows = await db
    .select({
      id: freezes.id,
      freezeStartDate: freezes.freezeStartDate,
      freezeEndDate: freezes.freezeEndDate,
      actualEndDate: freezes.actualEndDate,
      daysAdded: freezes.daysAdded,
      reason: freezes.reason,
      status: freezes.status,
      effectiveStatus: effectiveStatusSql,
      createdByName: createdBy.name,
      endedByName: endedBy.name,
      earlyUnfreezeReason: freezes.earlyUnfreezeReason,
      createdAt: freezes.createdAt,
    })
    .from(freezes)
    .leftJoin(createdBy, eq(createdBy.id, freezes.createdByUserId))
    .leftJoin(endedBy, eq(endedBy.id, freezes.endedByUserId))
    .where(
      and(
        eq(freezes.membershipId, membershipId),
        eq(freezes.gymId, session.gym.id),
        isNull(freezes.deletedAt),
      ),
    )
    .orderBy(desc(freezes.freezeStartDate), desc(freezes.createdAt));

  return rows;
}
