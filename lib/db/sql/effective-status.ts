import { sql } from "drizzle-orm";
import { freezes } from "@/lib/db/schema/freezes";
import { memberships, type MembershipStatus } from "@/lib/db/schema/memberships";

const istToday = sql`((now() at time zone 'Asia/Kolkata')::date)`;

/**
 * SQL fragment that derives a membership's effective status — the value
 * the UI should show. Computed on read so we don't need a daily expiry
 * cron: rows with `status='active'` whose `end_date < today` show as
 * `expired` without a write.
 *
 * The `frozen` branch is also computed on read by checking for an existing
 * non-deleted freeze on this membership whose date window contains today
 * (and whose status hasn't been cancelled_early). This means
 * `memberships.status` itself is never written to `'frozen'` — freeze state
 * lives entirely in the `freezes` table.
 */
export const effectiveStatusSql = sql<MembershipStatus>`
  case
    when ${memberships.status} = 'cancelled' then 'cancelled'
    when ${memberships.endDate} < ${istToday} then 'expired'
    when exists (
      select 1
      from ${freezes} f
      where f.membership_id = ${memberships.id}
        and f.deleted_at is null
        and f.status <> 'cancelled_early'
        and f.freeze_start_date <= ${istToday}
        and f.freeze_end_date >= ${istToday}
    ) then 'frozen'
    else 'active'
  end
`;
