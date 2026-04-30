import { sql } from "drizzle-orm";
import { memberships, type MembershipStatus } from "@/lib/db/schema/memberships";

/**
 * SQL fragment that derives a membership's effective status — the value
 * the UI should show. Computed on read so we don't need a daily expiry
 * cron: rows with `status='active'` whose `end_date < today` show as
 * `expired` without a write.
 */
export const effectiveStatusSql = sql<MembershipStatus>`
  case
    when ${memberships.status} = 'cancelled' then 'cancelled'
    when ${memberships.status} = 'frozen' then 'frozen'
    when ${memberships.endDate} < current_date then 'expired'
    else 'active'
  end
`;
