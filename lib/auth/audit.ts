import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema/audit-logs";
import { getCurrentSession } from "./get-session";

type AuditAction = "create" | "update" | "delete";

export type AuditInput = {
  entityType: string;
  entityId: string;
  action: AuditAction;
  before?: unknown;
  after?: unknown;
};

/**
 * Writes an audit row scoped to the currently authenticated user's gym.
 * Throws if called without a session — every mutation must have an actor.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error("recordAudit requires an authenticated session");
  }

  await db.insert(auditLogs).values({
    gymId: session.gym.id,
    userId: session.user.id,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    beforeJson: input.before === undefined ? null : (input.before as object),
    afterJson: input.after === undefined ? null : (input.after as object),
  });
}
