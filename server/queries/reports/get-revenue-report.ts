import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/get-session";
import { daysInRange, type DateRange } from "@/lib/utils/date-presets";
import { getPreviousPeriod } from "@/lib/utils/period-comparison";

export type RevenueReport = {
  range: DateRange;
  prior: DateRange | null;
  branchId: string | null;
  branchName: string | null;
  summary: {
    totalRevenuePaise: number; // gross — positive payments only
    refundsPaise: number; // positive (absolute sum of refund amounts)
    netPaise: number;
    transactionCount: number; // positive payments
    refundCount: number;
    daysInRange: number;
  };
  /** Same shape as `summary` for the prior period; null when no prior data. */
  priorSummary: {
    totalRevenuePaise: number;
    refundsPaise: number;
    netPaise: number;
    transactionCount: number;
    refundCount: number;
    daysInRange: number;
  } | null;
  daily: Array<{
    date: string; // YYYY-MM-DD
    paymentsPaise: number;
    refundsPaise: number; // negative-signed, matches DB convention
    netPaise: number;
    transactionCount: number; // payments + refunds rows
  }>;
};

/**
 * Daily revenue with zero-day fill via generate_series. Refunds are
 * stored as negative payments (Module 04 invariant), so SUM(amount_paise)
 * yields net directly. We split positive/negative for the breakdown
 * columns. All date math IST-anchored.
 */
type SummaryRow = {
  total_revenue_paise: number;
  refunds_paise: number;
  net_paise: number;
  transaction_count: number;
  refund_count: number;
};

async function fetchSummary(
  gymId: string,
  branchFilter: ReturnType<typeof sql>,
  range: DateRange,
): Promise<SummaryRow> {
  const result = (await db.execute<SummaryRow>(sql`
    select
      coalesce(sum(amount_paise) filter (where kind = 'payment'), 0)::int as total_revenue_paise,
      coalesce(-sum(amount_paise) filter (where kind = 'refund'), 0)::int as refunds_paise,
      coalesce(sum(amount_paise), 0)::int as net_paise,
      count(*) filter (where kind = 'payment')::int as transaction_count,
      count(*) filter (where kind = 'refund')::int as refund_count
    from payments
    where gym_id = ${gymId}::uuid
      and deleted_at is null
      and payment_date between ${range.from}::date and ${range.to}::date
      and branch_id ${branchFilter}
  `)) as unknown as SummaryRow[];
  return (
    result[0] ?? {
      total_revenue_paise: 0,
      refunds_paise: 0,
      net_paise: 0,
      transaction_count: 0,
      refund_count: 0,
    }
  );
}

export async function getRevenueReport(
  range: DateRange,
): Promise<RevenueReport> {
  const session = await requireUser();
  const branchId = session.activeBranch?.id ?? null;
  const branchName = session.activeBranch?.name ?? null;

  const branchFilter = branchId
    ? sql`= ${branchId}::uuid`
    : sql`is not null`;

  type DailyRow = {
    date: string;
    payments_paise: number;
    refunds_paise: number;
    net_paise: number;
    transaction_count: number;
  };

  const prior = getPreviousPeriod(range);

  const [dailyRows, summary, priorSummary] = await Promise.all([
    db.execute<DailyRow>(sql`
      with days as (
        select generate_series(
          ${range.from}::date,
          ${range.to}::date,
          '1 day'::interval
        )::date as d
      ),
      agg as (
        select
          payment_date as d,
          coalesce(sum(amount_paise) filter (where kind = 'payment'), 0)::int as payments_paise,
          coalesce(sum(amount_paise) filter (where kind = 'refund'), 0)::int as refunds_paise,
          coalesce(sum(amount_paise), 0)::int as net_paise,
          count(*)::int as transaction_count
        from payments
        where gym_id = ${session.gym.id}::uuid
          and deleted_at is null
          and payment_date between ${range.from}::date and ${range.to}::date
          and branch_id ${branchFilter}
        group by payment_date
      )
      select
        to_char(d.d, 'YYYY-MM-DD') as date,
        coalesce(a.payments_paise, 0)::int as payments_paise,
        coalesce(a.refunds_paise, 0)::int as refunds_paise,
        coalesce(a.net_paise, 0)::int as net_paise,
        coalesce(a.transaction_count, 0)::int as transaction_count
      from days d
      left join agg a on a.d = d.d
      order by d.d desc
    `),
    fetchSummary(session.gym.id, branchFilter, range),
    prior
      ? fetchSummary(session.gym.id, branchFilter, prior)
      : Promise.resolve(null),
  ]);

  const daily = (dailyRows as unknown as DailyRow[]).map((r) => ({
    date: r.date,
    paymentsPaise: Number(r.payments_paise) || 0,
    refundsPaise: Number(r.refunds_paise) || 0,
    netPaise: Number(r.net_paise) || 0,
    transactionCount: Number(r.transaction_count) || 0,
  }));

  return {
    range,
    prior,
    branchId,
    branchName,
    summary: {
      totalRevenuePaise: Number(summary.total_revenue_paise) || 0,
      refundsPaise: Number(summary.refunds_paise) || 0,
      netPaise: Number(summary.net_paise) || 0,
      transactionCount: Number(summary.transaction_count) || 0,
      refundCount: Number(summary.refund_count) || 0,
      daysInRange: daysInRange(range),
    },
    priorSummary: priorSummary
      ? {
          totalRevenuePaise: Number(priorSummary.total_revenue_paise) || 0,
          refundsPaise: Number(priorSummary.refunds_paise) || 0,
          netPaise: Number(priorSummary.net_paise) || 0,
          transactionCount: Number(priorSummary.transaction_count) || 0,
          refundCount: Number(priorSummary.refund_count) || 0,
          daysInRange: prior ? daysInRange(prior) : 0,
        }
      : null,
    daily,
  };
}
