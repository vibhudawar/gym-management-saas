import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/get-session";
import { daysInRange, type DateRange } from "@/lib/utils/date-presets";

const MAX_SPARKLINE_BUCKETS = 12;
const MIN_DAYS_FOR_SPARKLINE = 14;

export type PlanWiseReport = {
  range: DateRange;
  branchId: string | null;
  branchName: string | null;
  /** Number of weekly buckets shown in sparklines (0 if range < 2 weeks). */
  weekBuckets: number;
  rows: Array<{
    planId: string;
    planName: string;
    isActive: boolean;
    sold: number;
    grossRevenuePaise: number;
    avgTicketPaise: number;
    discountPaise: number;
    netPaise: number;
    /** Sales count per weekly bucket, oldest → newest. Empty when range too short. */
    weeklyCounts: number[];
  }>;
  totals: {
    sold: number;
    grossRevenuePaise: number;
    discountPaise: number;
    netPaise: number;
  };
};

/**
 * Aggregates memberships created within range, joined to plans. Counts
 * memberships not payments — a renewal in April is one sale in April even
 * if the plan was originally created in February. Inactive plans with
 * historical sales are still included (UI shows them with strikethrough).
 *
 * "Discount" here is the membership's own `discount_paise`, not aggregated
 * downstream. Gross = `plan_price_paise + addons_total_paise` so the breakdown
 * reads as "what was billable vs what was actually charged". Net here is
 * gross − discount, matching the membership's `final_amount_paise`.
 */
export async function getPlanWiseReport(
  range: DateRange,
): Promise<PlanWiseReport> {
  const session = await requireUser();
  const branchId = session.activeBranch?.id ?? null;
  const branchName = session.activeBranch?.name ?? null;

  const branchFilter = branchId
    ? sql`= ${branchId}::uuid`
    : sql`is not null`;

  type Row = {
    plan_id: string;
    plan_name: string;
    is_active: boolean;
    sold: number;
    gross_revenue_paise: number;
    discount_paise: number;
    net_paise: number;
  };

  const totalDays = daysInRange(range);
  const showSparkline = totalDays >= MIN_DAYS_FOR_SPARKLINE;
  // Bucket size in days so we get at most MAX_SPARKLINE_BUCKETS columns.
  const bucketDays = showSparkline
    ? Math.max(7, Math.ceil(totalDays / MAX_SPARKLINE_BUCKETS))
    : 0;
  const bucketCount = showSparkline
    ? Math.ceil(totalDays / bucketDays)
    : 0;

  const [rows, sparkRows] = await Promise.all([
    db.execute<Row>(sql`
      select
        p.id as plan_id,
        p.name as plan_name,
        p.is_active,
        count(*)::int as sold,
        coalesce(
          sum(m.plan_price_paise + m.addons_total_paise),
          0
        )::int as gross_revenue_paise,
        coalesce(sum(m.discount_paise), 0)::int as discount_paise,
        coalesce(sum(m.final_amount_paise), 0)::int as net_paise
      from memberships m
      join plans p on p.id = m.plan_id
      where m.gym_id = ${session.gym.id}::uuid
        and m.deleted_at is null
        and (m.created_at at time zone 'Asia/Kolkata')::date
            between ${range.from}::date and ${range.to}::date
        and m.branch_id ${branchFilter}
      group by p.id, p.name, p.is_active
      order by net_paise desc
    `),
    showSparkline
      ? db.execute<{ plan_id: string; bucket: number; sold: number }>(sql`
          with bucketed as (
            select
              m.plan_id,
              floor(
                ((m.created_at at time zone 'Asia/Kolkata')::date - ${range.from}::date)::numeric
                / ${bucketDays}::numeric
              )::int as bucket
            from memberships m
            where m.gym_id = ${session.gym.id}::uuid
              and m.deleted_at is null
              and (m.created_at at time zone 'Asia/Kolkata')::date
                  between ${range.from}::date and ${range.to}::date
              and m.branch_id ${branchFilter}
          )
          select plan_id, bucket, count(*)::int as sold
          from bucketed
          where bucket between 0 and ${bucketCount - 1}
          group by plan_id, bucket
        `)
      : Promise.resolve([]),
  ]);

  const planBuckets = new Map<string, number[]>();
  if (showSparkline) {
    for (const r of sparkRows as unknown as Array<{
      plan_id: string;
      bucket: number;
      sold: number;
    }>) {
      let counts = planBuckets.get(r.plan_id);
      if (!counts) {
        counts = new Array(bucketCount).fill(0);
        planBuckets.set(r.plan_id, counts);
      }
      const idx = Number(r.bucket);
      if (idx >= 0 && idx < bucketCount) {
        counts[idx] = Number(r.sold) || 0;
      }
    }
  }
  const planRows = rows as unknown as Row[];

  const totals = planRows.reduce(
    (acc, r) => ({
      sold: acc.sold + Number(r.sold),
      grossRevenuePaise: acc.grossRevenuePaise + Number(r.gross_revenue_paise),
      discountPaise: acc.discountPaise + Number(r.discount_paise),
      netPaise: acc.netPaise + Number(r.net_paise),
    }),
    { sold: 0, grossRevenuePaise: 0, discountPaise: 0, netPaise: 0 },
  );

  return {
    range,
    branchId,
    branchName,
    weekBuckets: showSparkline ? bucketCount : 0,
    rows: planRows.map((r) => {
      const sold = Number(r.sold);
      const gross = Number(r.gross_revenue_paise);
      const counts = showSparkline
        ? (planBuckets.get(r.plan_id) ?? new Array(bucketCount).fill(0))
        : [];
      return {
        planId: r.plan_id,
        planName: r.plan_name,
        isActive: r.is_active,
        sold,
        grossRevenuePaise: gross,
        avgTicketPaise: sold > 0 ? Math.round(gross / sold) : 0,
        discountPaise: Number(r.discount_paise),
        netPaise: Number(r.net_paise),
        weeklyCounts: counts,
      };
    }),
    totals,
  };
}
