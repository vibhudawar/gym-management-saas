import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { Role } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/get-session";

export type AuditEntry = {
  id: string;
  createdAt: Date;
  user: { id: string | null; name: string | null; role: Role | null };
  entityType: string;
  entityId: string;
  entityLabel: string;
  action: string;
  branchId: string | null;
  branchName: string | null;
  beforeJson: unknown;
  afterJson: unknown;
};

export type ListAuditInput = {
  branchId?: string | null;
  fromDate?: string; // YYYY-MM-DD inclusive
  toDate?: string; // YYYY-MM-DD inclusive
  entityType?: string;
  action?: string;
  userId?: string;
  entityId?: string; // when scoping to a single entity's full history
  page?: number;
  pageSize?: number;
};

export type ListAuditResult = {
  rows: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
};

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

/**
 * One filter-aware query that resolves user, branch, and a per-entity-type
 * label via LEFT JOINs. The CASE on entity_type is verbose but reads better
 * than a dispatching helper and gives Postgres a chance to cache the plan.
 *
 * For Branch Manager scope: rows with branch_id = NULL (gym-level entities)
 * are explicitly hidden in the application filter, even though RLS allows
 * them. Owners see them by default.
 */
export async function listAuditEntries(
  input: ListAuditInput = {},
): Promise<ListAuditResult> {
  const session = await requireUser();
  const isOwner = session.user.role === "owner";

  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, input.pageSize ?? DEFAULT_PAGE_SIZE),
  );
  const offset = (page - 1) * pageSize;

  const branchScopeSql = (() => {
    if (input.branchId === null || input.branchId === undefined) {
      // Branch Manager (or owner without an explicit "all branches" override)
      // — restrict by their own branch when one applies. Owners with
      // session.activeBranch null see everything.
      if (!isOwner && session.user.branchId) {
        return sql`and (audit_logs.branch_id = ${session.user.branchId}::uuid)`;
      }
      return sql``;
    }
    return sql`and audit_logs.branch_id = ${input.branchId}::uuid`;
  })();

  const filtersSql = sql`
    audit_logs.gym_id = ${session.gym.id}::uuid
    ${branchScopeSql}
    ${input.fromDate ? sql`and (audit_logs.created_at at time zone 'Asia/Kolkata')::date >= ${input.fromDate}::date` : sql``}
    ${input.toDate ? sql`and (audit_logs.created_at at time zone 'Asia/Kolkata')::date <= ${input.toDate}::date` : sql``}
    ${input.entityType ? sql`and audit_logs.entity_type = ${input.entityType}` : sql``}
    ${input.action ? sql`and audit_logs.action = ${input.action}` : sql``}
    ${input.userId ? sql`and audit_logs.user_id = ${input.userId}::uuid` : sql``}
    ${input.entityId ? sql`and audit_logs.entity_id = ${input.entityId}::uuid` : sql``}
  `;

  type Row = {
    id: string;
    created_at: Date;
    user_id: string | null;
    user_name: string | null;
    user_role: Role | null;
    entity_type: string;
    entity_id: string;
    entity_label: string;
    action: string;
    branch_id: string | null;
    branch_name: string | null;
    before_json: unknown;
    after_json: unknown;
    total_count: number;
  };

  const rows = (await db.execute<Row>(sql`
    select
      audit_logs.id::text as id,
      audit_logs.created_at,
      audit_logs.user_id,
      u.name as user_name,
      u.role as user_role,
      audit_logs.entity_type,
      audit_logs.entity_id,
      case audit_logs.entity_type
        when 'member' then m.name
        when 'payment' then concat(p.invoice_number, ' (', p.kind, ')')
        when 'membership' then concat(coalesce(plan_for_mb.name, 'Plan'), ' for ', coalesce(member_for_mb.name, 'member'))
        when 'plan' then pl.name
        when 'addon' then a.name
        when 'freeze' then concat('Freeze for ', coalesce(member_for_freeze.name, 'member'))
        when 'user' then us.name
        when 'gym' then g.name
        when 'branch' then br.name
        else audit_logs.entity_type || ' #' || left(audit_logs.entity_id::text, 8)
      end as entity_label,
      audit_logs.action,
      audit_logs.branch_id,
      b.name as branch_name,
      audit_logs.before_json,
      audit_logs.after_json,
      count(*) over () as total_count
    from audit_logs
    left join users u on u.id = audit_logs.user_id
    left join branches b on b.id = audit_logs.branch_id
    left join members m on m.id = audit_logs.entity_id and audit_logs.entity_type = 'member'
    left join payments p on p.id = audit_logs.entity_id and audit_logs.entity_type = 'payment'
    left join memberships mb on mb.id = audit_logs.entity_id and audit_logs.entity_type = 'membership'
    left join plans plan_for_mb on plan_for_mb.id = mb.plan_id
    left join members member_for_mb on member_for_mb.id = mb.member_id
    left join plans pl on pl.id = audit_logs.entity_id and audit_logs.entity_type = 'plan'
    left join add_ons a on a.id = audit_logs.entity_id and audit_logs.entity_type = 'addon'
    left join freezes f on f.id = audit_logs.entity_id and audit_logs.entity_type = 'freeze'
    left join members member_for_freeze on member_for_freeze.id = f.member_id
    left join users us on us.id = audit_logs.entity_id and audit_logs.entity_type = 'user'
    left join gyms g on g.id = audit_logs.entity_id and audit_logs.entity_type = 'gym'
    left join branches br on br.id = audit_logs.entity_id and audit_logs.entity_type = 'branch'
    where ${filtersSql}
    order by audit_logs.created_at desc, audit_logs.id desc
    limit ${pageSize} offset ${offset}
  `)) as unknown as Row[];

  const total = rows[0] ? Number(rows[0].total_count) || 0 : 0;

  return {
    rows: rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      user: {
        id: r.user_id,
        name: r.user_name,
        role: r.user_role,
      },
      entityType: r.entity_type,
      entityId: r.entity_id,
      entityLabel: r.entity_label,
      action: r.action,
      branchId: r.branch_id,
      branchName: r.branch_name,
      beforeJson: r.before_json,
      afterJson: r.after_json,
    })),
    total,
    page,
    pageSize,
  };
}
