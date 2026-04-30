import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema/audit-logs";
import { getCurrentSession } from "./get-session";

type AuditAction = "create" | "update" | "delete" | "correction" | "cancel";

export type AuditEntityType =
  | "gym"
  | "branch"
  | "user"
  | "plan"
  | "addon"
  | "member"
  | "membership"
  | "payment"
  | "freeze";

export type AuditInput = {
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  before?: unknown;
  after?: unknown;
};

const NOISE_FIELDS = new Set(["createdAt", "updatedAt", "created_at", "updated_at"]);

/**
 * Strip timestamp fields from an audited row so before/after diffs stay
 * meaningful — every update would otherwise look noisy because updatedAt
 * always changes.
 */
function stripNoise(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object" || Array.isArray(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (NOISE_FIELDS.has(k)) continue;
    out[k] = v;
  }
  return out;
}

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
    beforeJson:
      input.before === undefined ? null : (stripNoise(input.before) as object),
    afterJson:
      input.after === undefined ? null : (stripNoise(input.after) as object),
  });
}
