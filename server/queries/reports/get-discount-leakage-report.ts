import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/get-session";
import type { DateRange } from "@/lib/utils/date-presets";
import { getPreviousPeriod } from "@/lib/utils/period-comparison";

export const DISCOUNT_BUCKETS = [
  { key: "0_500", label: "₹0–500", min: 1, max: 500_00 },
  { key: "500_1k", label: "₹500–1k", min: 500_00 + 1, max: 1000_00 },
  { key: "1k_2_5k", label: "₹1k–2.5k", min: 1000_00 + 1, max: 2500_00 },
  { key: "2_5k_5k", label: "₹2.5k–5k", min: 2500_00 + 1, max: 5000_00 },
  { key: "5k_plus", label: "₹5k+", min: 5000_00 + 1, max: null as number | null },
] as const;

export type DiscountBucketKey = (typeof DISCOUNT_BUCKETS)[number]["key"];

export type DiscountLeakageReport = {
  range: DateRange;
  prior: DateRange | null;
  branchId: string | null;
  branchName: string | null;
  summary: {
    totalDiscountPaise: number;
    discountedMembershipCount: number;
    totalGrossPaise: number;
    avgDiscountPaise: number;
  };
  priorSummary: {
    totalDiscountPaise: number;
    discountedMembershipCount: number;
    totalGrossPaise: number;
    avgDiscountPaise: number;
  } | null;
  distribution: Array<{
    key: DiscountBucketKey;
    label: string;
    count: number;
  }>;
  byStaff: Array<{
    userId: string;
    userName: string;
    discountedCount: number;
    totalDiscountPaise: number;
    avgDiscountPaise: number;
    percentOfOwnRevenue: number; // 0..1
  }>;
  details: Array<{
    membershipId: string;
    memberId: string;
    memberName: string;
    planName: string;
    /** YYYY-MM-DD in IST — already cast in SQL so the UI doesn't worry about Date vs string. */
    createdDate: string;
    discountPaise: number;
    reason: string | null;
    enrolledByUserName: string | null;
  }>;
};

const DETAIL_CAP = 500;

export async function getDiscountLeakageReport(
  range: DateRange,
  options: { capDetails?: boolean } = {},
): Promise<DiscountLeakageReport> {
  const session = await requireUser();
  const branchId = session.activeBranch?.id ?? null;
  const branchName = session.activeBranch?.name ?? null;

  const branchFilter = branchId
    ? sql`= ${branchId}::uuid`
    : sql`is not null`;
  const detailLimit = options.capDetails === false ? sql`` : sql`limit ${DETAIL_CAP}`;

  type SummaryRow = {
    total_discount_paise: number;
    discounted_membership_count: number;
    total_gross_paise: number;
  };

  async function fetchSummaryFor(r: DateRange): Promise<SummaryRow> {
    const result = (await db.execute<SummaryRow>(sql`
      select
        coalesce(sum(discount_paise) filter (where discount_paise > 0), 0)::int as total_discount_paise,
        count(*) filter (where discount_paise > 0)::int as discounted_membership_count,
        coalesce(sum(plan_price_paise + addons_total_paise), 0)::int as total_gross_paise
      from memberships
      where gym_id = ${session.gym.id}::uuid
        and deleted_at is null
        and (created_at at time zone 'Asia/Kolkata')::date
            between ${r.from}::date and ${r.to}::date
        and branch_id ${branchFilter}
    `)) as unknown as SummaryRow[];
    return (
      result[0] ?? {
        total_discount_paise: 0,
        discounted_membership_count: 0,
        total_gross_paise: 0,
      }
    );
  }

  const prior = getPreviousPeriod(range);
  const [summary, priorSummaryRow] = await Promise.all([
    fetchSummaryFor(range).then((r) => [r] as SummaryRow[]),
    prior ? fetchSummaryFor(prior) : Promise.resolve(null),
  ]);

  type DistributionRow = { bucket: number; cnt: number };
  const distribution = (await db.execute<DistributionRow>(sql`
    select
      case
        when discount_paise between 1 and 50000 then 0
        when discount_paise between 50001 and 100000 then 1
        when discount_paise between 100001 and 250000 then 2
        when discount_paise between 250001 and 500000 then 3
        when discount_paise > 500000 then 4
      end as bucket,
      count(*)::int as cnt
    from memberships
    where gym_id = ${session.gym.id}::uuid
      and deleted_at is null
      and discount_paise > 0
      and (created_at at time zone 'Asia/Kolkata')::date
          between ${range.from}::date and ${range.to}::date
      and branch_id ${branchFilter}
    group by bucket
  `)) as unknown as DistributionRow[];

  const distCounts = new Array(DISCOUNT_BUCKETS.length).fill(0);
  for (const r of distribution) {
    const idx = Number(r.bucket);
    if (idx >= 0 && idx < distCounts.length) {
      distCounts[idx] = Number(r.cnt) || 0;
    }
  }

  type StaffRow = {
    user_id: string;
    user_name: string | null;
    discounted_count: number;
    total_discount_paise: number;
    own_gross_paise: number;
  };

  const staff = (await db.execute<StaffRow>(sql`
    select
      m.enrolled_by_user_id as user_id,
      u.name as user_name,
      count(*) filter (where m.discount_paise > 0)::int as discounted_count,
      coalesce(sum(m.discount_paise) filter (where m.discount_paise > 0), 0)::int as total_discount_paise,
      coalesce(sum(m.plan_price_paise + m.addons_total_paise), 0)::int as own_gross_paise
    from memberships m
    left join users u on u.id = m.enrolled_by_user_id
    where m.gym_id = ${session.gym.id}::uuid
      and m.deleted_at is null
      and (m.created_at at time zone 'Asia/Kolkata')::date
          between ${range.from}::date and ${range.to}::date
      and m.branch_id ${branchFilter}
    group by m.enrolled_by_user_id, u.name
    having count(*) filter (where m.discount_paise > 0) > 0
    order by total_discount_paise desc
  `)) as unknown as StaffRow[];

  type DetailRow = {
    membership_id: string;
    member_id: string;
    member_name: string;
    plan_name: string;
    created_date: string;
    discount_paise: number;
    reason: string | null;
    enrolled_by_user_name: string | null;
  };

  const details = (await db.execute<DetailRow>(sql`
    select
      m.id as membership_id,
      m.member_id,
      mb.name as member_name,
      p.name as plan_name,
      to_char((m.created_at at time zone 'Asia/Kolkata')::date, 'YYYY-MM-DD') as created_date,
      m.discount_paise,
      m.discount_reason as reason,
      u.name as enrolled_by_user_name
    from memberships m
    join members mb on mb.id = m.member_id
    join plans p on p.id = m.plan_id
    left join users u on u.id = m.enrolled_by_user_id
    where m.gym_id = ${session.gym.id}::uuid
      and m.deleted_at is null
      and m.discount_paise > 0
      and (m.created_at at time zone 'Asia/Kolkata')::date
          between ${range.from}::date and ${range.to}::date
      and m.branch_id ${branchFilter}
    order by m.created_at desc
    ${detailLimit}
  `)) as unknown as DetailRow[];

  const summaryRow = summary[0] ?? {
    total_discount_paise: 0,
    discounted_membership_count: 0,
    total_gross_paise: 0,
  };
  const totalDiscount = Number(summaryRow.total_discount_paise) || 0;
  const discountedCount = Number(summaryRow.discounted_membership_count) || 0;

  const priorSummary = priorSummaryRow
    ? (() => {
        const total = Number(priorSummaryRow.total_discount_paise) || 0;
        const count = Number(priorSummaryRow.discounted_membership_count) || 0;
        return {
          totalDiscountPaise: total,
          discountedMembershipCount: count,
          totalGrossPaise: Number(priorSummaryRow.total_gross_paise) || 0,
          avgDiscountPaise: count > 0 ? Math.round(total / count) : 0,
        };
      })()
    : null;

  return {
    range,
    prior,
    branchId,
    branchName,
    summary: {
      totalDiscountPaise: totalDiscount,
      discountedMembershipCount: discountedCount,
      totalGrossPaise: Number(summaryRow.total_gross_paise) || 0,
      avgDiscountPaise:
        discountedCount > 0 ? Math.round(totalDiscount / discountedCount) : 0,
    },
    priorSummary,
    distribution: DISCOUNT_BUCKETS.map((b, i) => ({
      key: b.key,
      label: b.label,
      count: distCounts[i],
    })),
    byStaff: staff.map((s) => {
      const totalDisc = Number(s.total_discount_paise) || 0;
      const ownGross = Number(s.own_gross_paise) || 0;
      const discCount = Number(s.discounted_count) || 0;
      return {
        userId: s.user_id,
        userName: s.user_name ?? "(removed user)",
        discountedCount: discCount,
        totalDiscountPaise: totalDisc,
        avgDiscountPaise: discCount > 0 ? Math.round(totalDisc / discCount) : 0,
        percentOfOwnRevenue: ownGross > 0 ? totalDisc / ownGross : 0,
      };
    }),
    details: details.map((d) => ({
      membershipId: d.membership_id,
      memberId: d.member_id,
      memberName: d.member_name,
      planName: d.plan_name,
      createdDate: d.created_date,
      discountPaise: Number(d.discount_paise) || 0,
      reason: d.reason,
      enrolledByUserName: d.enrolled_by_user_name,
    })),
  };
}
