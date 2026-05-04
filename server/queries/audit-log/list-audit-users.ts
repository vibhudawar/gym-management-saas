import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { Role } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/get-session";

export type AuditUserRow = {
  id: string;
  name: string;
  role: Role;
  entryCount: number;
};

/**
 * Powers the user filter dropdown — only staff who have at least one audit
 * entry in the current scope are returned, so the dropdown stays meaningful
 * on a fresh tenant.
 */
export async function listAuditUsers(): Promise<AuditUserRow[]> {
  const session = await requireUser();
  const isOwner = session.user.role === "owner";

  const branchScopeSql =
    !isOwner && session.user.branchId
      ? sql`and (audit_logs.branch_id = ${session.user.branchId}::uuid or audit_logs.branch_id is null)`
      : sql``;

  type Row = {
    id: string;
    name: string;
    role: Role;
    entry_count: number;
  };

  const rows = (await db.execute<Row>(sql`
    select
      u.id,
      u.name,
      u.role,
      count(*)::int as entry_count
    from audit_logs
    join users u on u.id = audit_logs.user_id
    where audit_logs.gym_id = ${session.gym.id}::uuid
      ${branchScopeSql}
    group by u.id, u.name, u.role
    order by u.name asc
  `)) as unknown as Row[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role,
    entryCount: Number(r.entry_count) || 0,
  }));
}
