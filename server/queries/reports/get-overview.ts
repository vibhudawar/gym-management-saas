import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/get-session";
import {
  daysInRange,
  type DateRange,
} from "@/lib/utils/date-presets";
import {
  deltaPercent,
  getPreviousPeriod,
} from "@/lib/utils/period-comparison";
import type { Anomaly, AnomalyContext } from "@/lib/utils/anomaly-rules/types";
import { detectAnomalies } from "@/server/services/anomaly-detection";

export type OverviewReport = {
  range: DateRange;
  prior: DateRange | null;
  branchId: string | null;
  branchName: string | null;
  headline: {
    netPaise: number;
    priorNetPaise: number | null;
    deltaPct: number | null;
    direction: "up" | "down" | "flat";
    newMembers: number;
    refundsPaise: number;
  };
  anomalies: Anomaly[];
  trend: {
    current: Array<{ date: string; netPaise: number }>;
    prior: Array<{ date: string; netPaise: number }> | null;
  };
  highlights: {
    bestDay: { date: string; netPaise: number; enrolments: number } | null;
    topPlan: { planName: string; netPaise: number; sold: number } | null;
    mostActiveDayOfWeek: { dayName: string; avgEnrolments: number } | null;
    slowestWeek: {
      weekStart: string;
      weekEnd: string;
      netPaise: number;
      avgWeekPaise: number;
    } | null;
  };
};

const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

async function fetchPeriodMetrics(
  gymId: string,
  branchFilter: ReturnType<typeof sql>,
  range: DateRange,
) {
  type Row = {
    net_paise: number;
    refunds_paise: number;
    refund_count: number;
    new_members: number;
    gross_paise: number;
    discount_paise: number;
    discounted_count: number;
    lapsed_count: number;
  };

  const result = (await db.execute<Row>(sql`
    with payment_agg as (
      select
        coalesce(sum(amount_paise), 0)::int as net_paise,
        coalesce(-sum(amount_paise) filter (where kind = 'refund'), 0)::int as refunds_paise,
        count(*) filter (where kind = 'refund')::int as refund_count
      from payments
      where gym_id = ${gymId}::uuid
        and deleted_at is null
        and payment_date between ${range.from}::date and ${range.to}::date
        and branch_id ${branchFilter}
    ),
    membership_agg as (
      select
        count(*)::int as new_members,
        coalesce(sum(plan_price_paise + addons_total_paise), 0)::int as gross_paise,
        coalesce(sum(discount_paise) filter (where discount_paise > 0), 0)::int as discount_paise,
        count(*) filter (where discount_paise > 0)::int as discounted_count
      from memberships
      where gym_id = ${gymId}::uuid
        and deleted_at is null
        and (created_at at time zone 'Asia/Kolkata')::date
            between ${range.from}::date and ${range.to}::date
        and branch_id ${branchFilter}
    ),
    lapsed_agg as (
      select count(*)::int as lapsed_count
      from memberships m
      where m.gym_id = ${gymId}::uuid
        and m.deleted_at is null
        and m.status = 'active'
        and m.end_date between ${range.from}::date and ${range.to}::date
        and m.branch_id ${branchFilter}
        and not exists (
          select 1 from memberships m2
          where m2.member_id = m.member_id
            and m2.deleted_at is null
            and m2.start_date > m.end_date
        )
    )
    select
      p.net_paise, p.refunds_paise, p.refund_count,
      mb.new_members, mb.gross_paise, mb.discount_paise, mb.discounted_count,
      l.lapsed_count
    from payment_agg p, membership_agg mb, lapsed_agg l
  `)) as unknown as Row[];

  return (
    result[0] ?? {
      net_paise: 0,
      refunds_paise: 0,
      refund_count: 0,
      new_members: 0,
      gross_paise: 0,
      discount_paise: 0,
      discounted_count: 0,
      lapsed_count: 0,
    }
  );
}

async function fetchDailyTrend(
  gymId: string,
  branchFilter: ReturnType<typeof sql>,
  range: DateRange,
): Promise<Array<{ date: string; netPaise: number }>> {
  type Row = { date: string; net_paise: number };
  const rows = (await db.execute<Row>(sql`
    with days as (
      select generate_series(${range.from}::date, ${range.to}::date, '1 day'::interval)::date as d
    ),
    agg as (
      select payment_date as d, coalesce(sum(amount_paise), 0)::int as net_paise
      from payments
      where gym_id = ${gymId}::uuid
        and deleted_at is null
        and payment_date between ${range.from}::date and ${range.to}::date
        and branch_id ${branchFilter}
      group by payment_date
    )
    select to_char(d.d, 'YYYY-MM-DD') as date, coalesce(a.net_paise, 0)::int as net_paise
    from days d
    left join agg a on a.d = d.d
    order by d.d asc
  `)) as unknown as Row[];
  return rows.map((r) => ({ date: r.date, netPaise: Number(r.net_paise) || 0 }));
}

async function fetchTopDiscountStaff(
  gymId: string,
  branchFilter: ReturnType<typeof sql>,
  range: DateRange,
): Promise<{ name: string; totalPaise: number } | null> {
  type Row = { name: string | null; total: number };
  const rows = (await db.execute<Row>(sql`
    select u.name, coalesce(sum(m.discount_paise), 0)::int as total
    from memberships m
    left join users u on u.id = m.enrolled_by_user_id
    where m.gym_id = ${gymId}::uuid
      and m.deleted_at is null
      and m.discount_paise > 0
      and (m.created_at at time zone 'Asia/Kolkata')::date
          between ${range.from}::date and ${range.to}::date
      and m.branch_id ${branchFilter}
    group by u.name
    order by total desc
    limit 1
  `)) as unknown as Row[];
  if (rows.length === 0 || !rows[0].name) return null;
  return { name: rows[0].name, totalPaise: Number(rows[0].total) || 0 };
}

async function fetchLargeDiscounts(
  gymId: string,
  branchFilter: ReturnType<typeof sql>,
  range: DateRange,
) {
  type Row = {
    member_id: string;
    member_name: string;
    plan_name: string;
    discount_paise: number;
    plan_price_paise: number;
  };
  const rows = (await db.execute<Row>(sql`
    select
      m.member_id, mb.name as member_name, p.name as plan_name,
      m.discount_paise, m.plan_price_paise
    from memberships m
    join members mb on mb.id = m.member_id
    join plans p on p.id = m.plan_id
    where m.gym_id = ${gymId}::uuid
      and m.deleted_at is null
      and m.discount_paise > 0
      and m.plan_price_paise > 0
      and (m.discount_paise::numeric / m.plan_price_paise) >= 0.25
      and (m.created_at at time zone 'Asia/Kolkata')::date
          between ${range.from}::date and ${range.to}::date
      and m.branch_id ${branchFilter}
    order by m.discount_paise desc
    limit 10
  `)) as unknown as Row[];
  return rows.map((r) => ({
    memberId: r.member_id,
    memberName: r.member_name,
    planName: r.plan_name,
    discountPaise: Number(r.discount_paise) || 0,
    planPricePaise: Number(r.plan_price_paise) || 0,
  }));
}

async function fetchTopPlan(
  gymId: string,
  branchFilter: ReturnType<typeof sql>,
  range: DateRange,
): Promise<{ planName: string; netPaise: number; sold: number } | null> {
  type Row = { plan_name: string; net_paise: number; sold: number };
  const rows = (await db.execute<Row>(sql`
    select p.name as plan_name,
      coalesce(sum(m.final_amount_paise), 0)::int as net_paise,
      count(*)::int as sold
    from memberships m
    join plans p on p.id = m.plan_id
    where m.gym_id = ${gymId}::uuid
      and m.deleted_at is null
      and (m.created_at at time zone 'Asia/Kolkata')::date
          between ${range.from}::date and ${range.to}::date
      and m.branch_id ${branchFilter}
    group by p.id, p.name
    order by net_paise desc
    limit 1
  `)) as unknown as Row[];
  if (rows.length === 0) return null;
  return {
    planName: rows[0].plan_name,
    netPaise: Number(rows[0].net_paise) || 0,
    sold: Number(rows[0].sold) || 0,
  };
}

async function fetchBestDay(
  gymId: string,
  branchFilter: ReturnType<typeof sql>,
  range: DateRange,
) {
  type Row = { d: string; net_paise: number; enrolments: number };
  const rows = (await db.execute<Row>(sql`
    with day_revenue as (
      select payment_date as d, coalesce(sum(amount_paise), 0)::int as net_paise
      from payments
      where gym_id = ${gymId}::uuid
        and deleted_at is null
        and payment_date between ${range.from}::date and ${range.to}::date
        and branch_id ${branchFilter}
      group by payment_date
    ),
    day_enrol as (
      select (created_at at time zone 'Asia/Kolkata')::date as d, count(*)::int as enrolments
      from memberships
      where gym_id = ${gymId}::uuid
        and deleted_at is null
        and (created_at at time zone 'Asia/Kolkata')::date
            between ${range.from}::date and ${range.to}::date
        and branch_id ${branchFilter}
      group by (created_at at time zone 'Asia/Kolkata')::date
    )
    select to_char(coalesce(dr.d, de.d), 'YYYY-MM-DD') as d,
           coalesce(dr.net_paise, 0)::int as net_paise,
           coalesce(de.enrolments, 0)::int as enrolments
    from day_revenue dr
    full outer join day_enrol de on de.d = dr.d
    where coalesce(dr.net_paise, 0) > 0
    order by net_paise desc
    limit 1
  `)) as unknown as Row[];
  if (rows.length === 0) return null;
  return {
    date: rows[0].d,
    netPaise: Number(rows[0].net_paise) || 0,
    enrolments: Number(rows[0].enrolments) || 0,
  };
}

async function fetchMostActiveDow(
  gymId: string,
  branchFilter: ReturnType<typeof sql>,
  range: DateRange,
): Promise<{ dayName: string; avgEnrolments: number } | null> {
  // Need at least 2 weeks of data for the average to be meaningful.
  if (daysInRange(range) < 14) return null;

  type Row = { dow: number; avg_enrolments: number };
  const rows = (await db.execute<Row>(sql`
    with day_count as (
      select
        (created_at at time zone 'Asia/Kolkata')::date as d,
        count(*)::int as enrolments
      from memberships
      where gym_id = ${gymId}::uuid
        and deleted_at is null
        and (created_at at time zone 'Asia/Kolkata')::date
            between ${range.from}::date and ${range.to}::date
        and branch_id ${branchFilter}
      group by (created_at at time zone 'Asia/Kolkata')::date
    ),
    days_in_range as (
      select generate_series(${range.from}::date, ${range.to}::date, '1 day'::interval)::date as d
    ),
    by_dow as (
      select
        extract(dow from d.d)::int as dow,
        coalesce(dc.enrolments, 0) as enrolments
      from days_in_range d
      left join day_count dc on dc.d = d.d
    )
    select dow, round(avg(enrolments)::numeric, 1)::float as avg_enrolments
    from by_dow
    group by dow
    order by avg_enrolments desc
    limit 1
  `)) as unknown as Row[];
  if (rows.length === 0) return null;
  const r = rows[0];
  if (Number(r.avg_enrolments) <= 0) return null;
  return {
    dayName: DAYS_OF_WEEK[Number(r.dow) % 7] ?? "Unknown",
    avgEnrolments: Number(r.avg_enrolments),
  };
}

async function fetchWeeklyNet(
  gymId: string,
  branchFilter: ReturnType<typeof sql>,
  range: DateRange,
) {
  type Row = { week_start: string; week_end: string; net_paise: number };
  const rows = (await db.execute<Row>(sql`
    with weeks as (
      select
        generate_series(
          date_trunc('week', ${range.from}::date),
          ${range.to}::date,
          '7 days'::interval
        )::date as ws
    ),
    bounded as (
      select
        greatest(ws, ${range.from}::date) as week_start,
        least(ws + 6, ${range.to}::date) as week_end
      from weeks
      where ws + 6 >= ${range.from}::date
        and ws <= ${range.to}::date
    ),
    payments_in as (
      select payment_date as d, amount_paise
      from payments
      where gym_id = ${gymId}::uuid
        and deleted_at is null
        and payment_date between ${range.from}::date and ${range.to}::date
        and branch_id ${branchFilter}
    )
    select
      to_char(b.week_start, 'YYYY-MM-DD') as week_start,
      to_char(b.week_end, 'YYYY-MM-DD') as week_end,
      coalesce(sum(p.amount_paise), 0)::int as net_paise
    from bounded b
    left join payments_in p on p.d between b.week_start and b.week_end
    group by b.week_start, b.week_end
    order by b.week_start asc
  `)) as unknown as Row[];
  return rows.map((r) => ({
    weekStart: r.week_start,
    weekEnd: r.week_end,
    netPaise: Number(r.net_paise) || 0,
  }));
}

async function fetchPriorLapsedCount(
  gymId: string,
  branchFilter: ReturnType<typeof sql>,
  prior: DateRange,
): Promise<number> {
  type Row = { lapsed_count: number };
  const rows = (await db.execute<Row>(sql`
    select count(*)::int as lapsed_count
    from memberships m
    where m.gym_id = ${gymId}::uuid
      and m.deleted_at is null
      and m.status = 'active'
      and m.end_date between ${prior.from}::date and ${prior.to}::date
      and m.branch_id ${branchFilter}
      and not exists (
        select 1 from memberships m2
        where m2.member_id = m.member_id
          and m2.deleted_at is null
          and m2.start_date > m.end_date
      )
  `)) as unknown as Row[];
  return rows[0] ? Number(rows[0].lapsed_count) || 0 : 0;
}

/**
 * Composes everything the Overview tab needs in one parallel wave.
 * Performance target: <500ms on a gym with 1 year of data + 5k members.
 */
export async function getOverviewReport(
  range: DateRange,
): Promise<OverviewReport> {
  const session = await requireUser();
  const branchId = session.activeBranch?.id ?? null;
  const branchName = session.activeBranch?.name ?? null;
  const branchFilter = branchId ? sql`= ${branchId}::uuid` : sql`is not null`;
  const prior = getPreviousPeriod(range);

  const [
    current,
    priorMetrics,
    currentTrend,
    priorTrend,
    topStaff,
    largeDiscounts,
    topPlan,
    bestDay,
    mostActiveDow,
    weeklyNet,
    priorLapsedCount,
  ] = await Promise.all([
    fetchPeriodMetrics(session.gym.id, branchFilter, range),
    prior ? fetchPeriodMetrics(session.gym.id, branchFilter, prior) : Promise.resolve(null),
    fetchDailyTrend(session.gym.id, branchFilter, range),
    prior ? fetchDailyTrend(session.gym.id, branchFilter, prior) : Promise.resolve(null),
    fetchTopDiscountStaff(session.gym.id, branchFilter, range),
    fetchLargeDiscounts(session.gym.id, branchFilter, range),
    fetchTopPlan(session.gym.id, branchFilter, range),
    fetchBestDay(session.gym.id, branchFilter, range),
    fetchMostActiveDow(session.gym.id, branchFilter, range),
    fetchWeeklyNet(session.gym.id, branchFilter, range),
    prior ? fetchPriorLapsedCount(session.gym.id, branchFilter, prior) : Promise.resolve(null),
  ]);

  const headlineDelta =
    priorMetrics === null
      ? { pct: null as number | null, direction: "flat" as const }
      : (() => {
          const d = deltaPercent(current.net_paise, priorMetrics.net_paise);
          return { pct: d.pct, direction: d.direction };
        })();

  const ctx: AnomalyContext = {
    range,
    prior,
    netPaise: Number(current.net_paise) || 0,
    priorNetPaise: priorMetrics ? Number(priorMetrics.net_paise) || 0 : null,
    grossPaise: Number(current.gross_paise) || 0,
    refundsPaise: Number(current.refunds_paise) || 0,
    refundCount: Number(current.refund_count) || 0,
    priorRefundsPaise: priorMetrics ? Number(priorMetrics.refunds_paise) || 0 : null,
    priorRefundCount: priorMetrics ? Number(priorMetrics.refund_count) || 0 : null,
    discountPaise: Number(current.discount_paise) || 0,
    discountedCount: Number(current.discounted_count) || 0,
    topDiscountStaff: topStaff,
    largeDiscountMemberships: largeDiscounts,
    lapsedCount: Number(current.lapsed_count) || 0,
    priorLapsedCount: priorLapsedCount,
    weeklyNetPaise: weeklyNet,
  };

  const anomalies = detectAnomalies(ctx);

  const slowestWeek = (() => {
    if (weeklyNet.length < 2) return null;
    const sum = weeklyNet.reduce((acc, w) => acc + w.netPaise, 0);
    if (sum <= 0) return null;
    const avg = Math.round(sum / weeklyNet.length);
    const slowest = [...weeklyNet].sort((a, b) => a.netPaise - b.netPaise)[0];
    if (slowest.netPaise / avg > 0.6) return null;
    return {
      weekStart: slowest.weekStart,
      weekEnd: slowest.weekEnd,
      netPaise: slowest.netPaise,
      avgWeekPaise: avg,
    };
  })();

  return {
    range,
    prior,
    branchId,
    branchName,
    headline: {
      netPaise: Number(current.net_paise) || 0,
      priorNetPaise: priorMetrics ? Number(priorMetrics.net_paise) || 0 : null,
      deltaPct: headlineDelta.pct,
      direction: headlineDelta.direction,
      newMembers: Number(current.new_members) || 0,
      refundsPaise: Number(current.refunds_paise) || 0,
    },
    anomalies,
    trend: {
      current: currentTrend,
      prior: priorTrend,
    },
    highlights: {
      bestDay,
      topPlan,
      mostActiveDayOfWeek: mostActiveDow,
      slowestWeek,
    },
  };
}
