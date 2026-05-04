import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/get-session";

/**
 * Distinct (entity_type, action) pairs that exist in the gym's audit log,
 * used to build the entity-type and action filter dropdowns. Returning
 * pairs lets the action dropdown adapt to the selected entity type later
 * without another query.
 */
export async function listDistinctEntityActions(): Promise<{
  entityTypes: string[];
  actions: string[];
}> {
  const session = await requireUser();
  const isOwner = session.user.role === "owner";

  const branchScope =
    !isOwner && session.user.branchId
      ? sql`and (branch_id = ${session.user.branchId}::uuid or branch_id is null)`
      : sql``;

  type Row = { entity_type: string; action: string };
  const rows = (await db.execute<Row>(sql`
    select distinct entity_type, action
    from audit_logs
    where gym_id = ${session.gym.id}::uuid
      ${branchScope}
    order by entity_type, action
  `)) as unknown as Row[];

  const entityTypes = Array.from(new Set(rows.map((r) => r.entity_type)));
  const actions = Array.from(new Set(rows.map((r) => r.action)));

  return { entityTypes, actions };
}
