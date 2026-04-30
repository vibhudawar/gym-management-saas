import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema/audit-logs";
import { users } from "@/lib/db/schema/users";
import { requireUser } from "@/lib/auth/get-session";

export type MemberAuditEntry = {
  id: bigint;
  action: string;
  createdAt: Date;
  actorName: string | null;
};

export async function listMemberAuditEntries(
  memberId: string,
  limit = 5,
): Promise<MemberAuditEntry[]> {
  const session = await requireUser();
  // Receptionists may not see audit; render empty.
  if (session.user.role === "receptionist") return [];

  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      createdAt: auditLogs.createdAt,
      actorName: users.name,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .where(
      and(
        eq(auditLogs.gymId, session.gym.id),
        inArray(auditLogs.entityType, ["member"]),
        eq(auditLogs.entityId, memberId),
      ),
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  return rows;
}
