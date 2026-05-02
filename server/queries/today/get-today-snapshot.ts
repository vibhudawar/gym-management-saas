import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { branches } from "@/lib/db/schema/branches";
import { members } from "@/lib/db/schema/members";
import { memberships } from "@/lib/db/schema/memberships";
import { payments } from "@/lib/db/schema/payments";
import { plans } from "@/lib/db/schema/plans";
import { reminders, type ReminderChannel, type ReminderStatus } from "@/lib/db/schema/reminders";
import { users } from "@/lib/db/schema/users";
import { requireUser } from "@/lib/auth/get-session";

export const EXPIRING_WINDOW_DAYS = 14;
export const RECENTLY_EXPIRED_WINDOW_DAYS = 30;

export type ActionRow = {
  memberId: string;
  membershipId: string;
  memberName: string;
  memberPhone: string;
  planName: string;
  endDate: string;
  daysFromToday: number;
  branchName: string;
  latestReminder: {
    sentAt: Date;
    channel: ReminderChannel;
    status: ReminderStatus;
  } | null;
};

export type EnrolledTodayRow = {
  membershipId: string;
  memberId: string;
  memberName: string;
  memberPhone: string;
  planName: string;
  isFirstEnrollment: boolean;
  amountPaise: number;
  paymentMode: string | null;
  enrolledAt: Date;
  enrolledByUserId: string;
  enrolledByUserName: string | null;
};

export type TodaySnapshot = {
  asOf: Date;
  branchId: string | null;
  branchName: string | null;
  metrics: {
    revenueTodayPaise: number;
    revenueYesterdayPaise: number;
    enrollmentsToday: number;
    enrollmentsYesterday: number;
    expiringIn14d: number;
    expiringIn7d: number;
    expiringIn3d: number;
    frozenNow: number;
    resumingIn7d: number;
  };
  expiringSoon: ActionRow[];
  expiringSoonTotal: number;
  recentlyExpired: ActionRow[];
  recentlyExpiredTotal: number;
  enrolledToday: EnrolledTodayRow[];
  enrolledTodayTotal: number;
};

const ACTION_LIST_LIMIT = 5;
const ENROLLED_LIST_LIMIT = 10;

/**
 * Single-call dashboard query. Runs ~6 queries in parallel, all aggregated
 * server-side to keep the page well under the 200ms budget at 5,000 members.
 *
 * Branch scoping follows `session.activeBranch` — owners with no override see
 * the gym aggregate; owners viewing a single branch see only that branch;
 * non-owners always see their permanent branch.
 *
 * Time-of-day discipline: "today" / "yesterday" are anchored to IST via the
 * Postgres `current_date` (the DB session is on a UTC server, but we explicitly
 * compute IST date boundaries so a payment at 11:55 PM IST counts for today).
 */
export async function getTodaySnapshot(): Promise<TodaySnapshot> {
  const session = await requireUser();
  const branchScope = session.activeBranch;
  const branchId = branchScope?.id ?? null;
  const branchName = branchScope?.name ?? null;

  const branchFilter = branchId
    ? sql`= ${branchId}::uuid`
    : sql`is not null`;

  // IST-anchored date arithmetic. The `(now() at time zone 'Asia/Kolkata')::date`
  // expression yields today's IST calendar date regardless of server tz.
  const istToday = sql`((now() at time zone 'Asia/Kolkata')::date)`;
  const istYesterday = sql`((now() at time zone 'Asia/Kolkata')::date - 1)`;

  const [
    revenueRows,
    enrollmentRows,
    expiringMetrics,
    frozenMetrics,
    expiringList,
    expiredList,
    enrolledTodayList,
  ] = await Promise.all([
    // Revenue today + yesterday in one row each (two-row resultset).
    db.execute<{
      bucket: "today" | "yesterday";
      total_paise: number;
    }>(sql`
      select
        case when payment_date = ${istToday} then 'today' else 'yesterday' end as bucket,
        coalesce(sum(amount_paise), 0)::int as total_paise
      from ${payments}
      where gym_id = ${session.gym.id}
        and deleted_at is null
        and payment_date in (${istToday}, ${istYesterday})
        and branch_id ${branchFilter}
      group by 1
    `),

    // New enrollments today + yesterday.
    db.execute<{
      bucket: "today" | "yesterday";
      cnt: number;
    }>(sql`
      select
        case
          when (created_at at time zone 'Asia/Kolkata')::date = ${istToday}
            then 'today'
          else 'yesterday'
        end as bucket,
        count(*)::int as cnt
      from ${memberships}
      where gym_id = ${session.gym.id}
        and deleted_at is null
        and (created_at at time zone 'Asia/Kolkata')::date in (${istToday}, ${istYesterday})
        and branch_id ${branchFilter}
      group by 1
    `),

    // Expiring breakdown — bucket counts at 14d / 7d / 3d.
    db.execute<{
      window_14d: number;
      window_7d: number;
      window_3d: number;
    }>(sql`
      select
        count(*) filter (
          where end_date - ${istToday} between 0 and 14
        )::int as window_14d,
        count(*) filter (
          where end_date - ${istToday} between 0 and 7
        )::int as window_7d,
        count(*) filter (
          where end_date - ${istToday} between 0 and 3
        )::int as window_3d
      from ${memberships}
      where gym_id = ${session.gym.id}
        and deleted_at is null
        and status = 'active'
        and end_date >= ${istToday}
        and branch_id ${branchFilter}
    `),

    // Frozen now + resuming in next 7 days. The "resuming" half is a v1.x
    // placeholder (freeze module isn't built yet — there's no freeze_until
    // column), so it returns zero. Schema is shaped for the eventual feature.
    db.execute<{
      frozen_now: number;
    }>(sql`
      select count(*)::int as frozen_now
      from ${memberships}
      where gym_id = ${session.gym.id}
        and deleted_at is null
        and status = 'frozen'
        and branch_id ${branchFilter}
    `),

    // Expiring soon — top N + total count, with each row's most-recent
    // reminder joined. We materialize just the columns we need.
    db.execute<{
      member_id: string;
      membership_id: string;
      member_name: string;
      member_phone: string;
      plan_name: string;
      end_date: string;
      days_from_today: number;
      branch_name: string;
      reminder_sent_at: Date | null;
      reminder_channel: ReminderChannel | null;
      reminder_status: ReminderStatus | null;
      total_count: number;
    }>(sql`
      with eligible as (
        select
          ${memberships.id} as membership_id,
          ${memberships.memberId} as member_id,
          ${memberships.endDate} as end_date,
          ${memberships.branchId} as branch_id,
          ${memberships.planId} as plan_id,
          (${memberships.endDate} - ${istToday})::int as days_from_today
        from ${memberships}
        where ${memberships.gymId} = ${session.gym.id}
          and ${memberships.deletedAt} is null
          and ${memberships.status} = 'active'
          and ${memberships.endDate} between ${istToday}
            and ${istToday} + ${EXPIRING_WINDOW_DAYS}::int
          and ${memberships.branchId} ${branchFilter}
      ),
      total as (select count(*)::int as cnt from eligible),
      ranked as (
        select e.*
        from eligible e
        order by e.end_date asc
        limit ${ACTION_LIST_LIMIT}
      ),
      latest_reminder as (
        select distinct on (r.membership_id)
          r.membership_id,
          r.sent_at,
          r.channel,
          r.status
        from ${reminders} r
        where r.gym_id = ${session.gym.id}
          and r.membership_id in (select membership_id from ranked)
        order by r.membership_id, r.sent_at desc
      )
      select
        r.member_id,
        r.membership_id,
        m.name as member_name,
        m.phone as member_phone,
        p.name as plan_name,
        to_char(r.end_date, 'YYYY-MM-DD') as end_date,
        r.days_from_today,
        b.name as branch_name,
        lr.sent_at as reminder_sent_at,
        lr.channel as reminder_channel,
        lr.status as reminder_status,
        (select cnt from total) as total_count
      from ranked r
      join ${members} m on m.id = r.member_id
      join ${plans} p on p.id = r.plan_id
      join ${branches} b on b.id = r.branch_id
      left join latest_reminder lr on lr.membership_id = r.membership_id
      order by r.end_date asc
    `),

    // Recently expired — last 30 days. effective_status logic: we accept rows
    // with status='active' but end_date < today (so they show as 'expired'
    // without a write).
    db.execute<{
      member_id: string;
      membership_id: string;
      member_name: string;
      member_phone: string;
      plan_name: string;
      end_date: string;
      days_from_today: number;
      branch_name: string;
      reminder_sent_at: Date | null;
      reminder_channel: ReminderChannel | null;
      reminder_status: ReminderStatus | null;
      total_count: number;
    }>(sql`
      with eligible as (
        select
          ${memberships.id} as membership_id,
          ${memberships.memberId} as member_id,
          ${memberships.endDate} as end_date,
          ${memberships.branchId} as branch_id,
          ${memberships.planId} as plan_id,
          (${memberships.endDate} - ${istToday})::int as days_from_today
        from ${memberships}
        where ${memberships.gymId} = ${session.gym.id}
          and ${memberships.deletedAt} is null
          and ${memberships.status} = 'active'
          and ${memberships.endDate} < ${istToday}
          and ${memberships.endDate} >= ${istToday} - ${RECENTLY_EXPIRED_WINDOW_DAYS}::int
          and ${memberships.branchId} ${branchFilter}
      ),
      total as (select count(*)::int as cnt from eligible),
      ranked as (
        select e.*
        from eligible e
        order by e.end_date desc
        limit ${ACTION_LIST_LIMIT}
      ),
      latest_reminder as (
        select distinct on (r.membership_id)
          r.membership_id,
          r.sent_at,
          r.channel,
          r.status
        from ${reminders} r
        where r.gym_id = ${session.gym.id}
          and r.membership_id in (select membership_id from ranked)
        order by r.membership_id, r.sent_at desc
      )
      select
        r.member_id,
        r.membership_id,
        m.name as member_name,
        m.phone as member_phone,
        p.name as plan_name,
        to_char(r.end_date, 'YYYY-MM-DD') as end_date,
        r.days_from_today,
        b.name as branch_name,
        lr.sent_at as reminder_sent_at,
        lr.channel as reminder_channel,
        lr.status as reminder_status,
        (select cnt from total) as total_count
      from ranked r
      join ${members} m on m.id = r.member_id
      join ${plans} p on p.id = r.plan_id
      join ${branches} b on b.id = r.branch_id
      left join latest_reminder lr on lr.membership_id = r.membership_id
      order by r.end_date desc
    `),

    // Enrolled today — top 10 + total count. Includes "first enrollment" flag
    // (true when this membership is the member's earliest non-deleted one).
    db.execute<{
      membership_id: string;
      member_id: string;
      member_name: string;
      member_phone: string;
      plan_name: string;
      is_first_enrollment: boolean;
      amount_paise: number;
      payment_mode: string | null;
      enrolled_at: Date;
      enrolled_by_user_id: string;
      enrolled_by_user_name: string | null;
      total_count: number;
    }>(sql`
      with todays as (
        select
          ${memberships.id} as membership_id,
          ${memberships.memberId} as member_id,
          ${memberships.planId} as plan_id,
          ${memberships.finalAmountPaise} as amount_paise,
          ${memberships.createdAt} as enrolled_at,
          ${memberships.enrolledByUserId} as enrolled_by_user_id
        from ${memberships}
        where ${memberships.gymId} = ${session.gym.id}
          and ${memberships.deletedAt} is null
          and (${memberships.createdAt} at time zone 'Asia/Kolkata')::date = ${istToday}
          and ${memberships.branchId} ${branchFilter}
      ),
      total as (select count(*)::int as cnt from todays),
      ranked as (
        select t.*
        from todays t
        order by t.enrolled_at desc
        limit ${ENROLLED_LIST_LIMIT}
      )
      select
        r.membership_id,
        r.member_id,
        m.name as member_name,
        m.phone as member_phone,
        p.name as plan_name,
        (
          select min(m2.created_at) = r.enrolled_at
          from ${memberships} m2
          where m2.member_id = r.member_id
            and m2.deleted_at is null
        ) as is_first_enrollment,
        r.amount_paise,
        (
          select pay.payment_mode
          from ${payments} pay
          where pay.membership_id = r.membership_id
            and pay.kind = 'payment'
            and pay.deleted_at is null
          order by pay.created_at asc
          limit 1
        ) as payment_mode,
        r.enrolled_at,
        r.enrolled_by_user_id,
        u.name as enrolled_by_user_name,
        (select cnt from total) as total_count
      from ranked r
      join ${members} m on m.id = r.member_id
      join ${plans} p on p.id = r.plan_id
      left join ${users} u on u.id = r.enrolled_by_user_id
      order by r.enrolled_at desc
    `),
  ]);

  // ---- shape ---------------------------------------------------------------
  const revenueByBucket = new Map<string, number>();
  for (const row of revenueRows as unknown as Array<{
    bucket: string;
    total_paise: number;
  }>) {
    revenueByBucket.set(row.bucket, Number(row.total_paise) || 0);
  }

  const enrollmentsByBucket = new Map<string, number>();
  for (const row of enrollmentRows as unknown as Array<{
    bucket: string;
    cnt: number;
  }>) {
    enrollmentsByBucket.set(row.bucket, Number(row.cnt) || 0);
  }

  const expiring = (expiringMetrics as unknown as Array<{
    window_14d: number;
    window_7d: number;
    window_3d: number;
  }>)[0] ?? { window_14d: 0, window_7d: 0, window_3d: 0 };

  const frozen = (frozenMetrics as unknown as Array<{ frozen_now: number }>)[0] ?? {
    frozen_now: 0,
  };

  const shapeActionRows = (
    rows: Array<{
      member_id: string;
      membership_id: string;
      member_name: string;
      member_phone: string;
      plan_name: string;
      end_date: string;
      days_from_today: number;
      branch_name: string;
      reminder_sent_at: Date | null;
      reminder_channel: ReminderChannel | null;
      reminder_status: ReminderStatus | null;
      total_count: number;
    }>,
  ): { rows: ActionRow[]; total: number } => {
    const total = rows[0]?.total_count ?? 0;
    return {
      total: Number(total),
      rows: rows.map((r) => ({
        memberId: r.member_id,
        membershipId: r.membership_id,
        memberName: r.member_name,
        memberPhone: r.member_phone,
        planName: r.plan_name,
        endDate: r.end_date,
        daysFromToday: Number(r.days_from_today),
        branchName: r.branch_name,
        latestReminder: r.reminder_sent_at
          ? {
              sentAt: r.reminder_sent_at,
              channel: r.reminder_channel as ReminderChannel,
              status: r.reminder_status as ReminderStatus,
            }
          : null,
      })),
    };
  };

  const expiringShaped = shapeActionRows(
    expiringList as unknown as Parameters<typeof shapeActionRows>[0],
  );
  const expiredShaped = shapeActionRows(
    expiredList as unknown as Parameters<typeof shapeActionRows>[0],
  );

  const enrolledRows = enrolledTodayList as unknown as Array<{
    membership_id: string;
    member_id: string;
    member_name: string;
    member_phone: string;
    plan_name: string;
    is_first_enrollment: boolean;
    amount_paise: number;
    payment_mode: string | null;
    enrolled_at: Date;
    enrolled_by_user_id: string;
    enrolled_by_user_name: string | null;
    total_count: number;
  }>;

  const enrolledTotal = Number(enrolledRows[0]?.total_count ?? 0);
  const enrolledTodayShaped: EnrolledTodayRow[] = enrolledRows.map((r) => ({
    membershipId: r.membership_id,
    memberId: r.member_id,
    memberName: r.member_name,
    memberPhone: r.member_phone,
    planName: r.plan_name,
    isFirstEnrollment: !!r.is_first_enrollment,
    amountPaise: Number(r.amount_paise) || 0,
    paymentMode: r.payment_mode,
    enrolledAt: r.enrolled_at,
    enrolledByUserId: r.enrolled_by_user_id,
    enrolledByUserName: r.enrolled_by_user_name,
  }));

  return {
    asOf: new Date(),
    branchId,
    branchName,
    metrics: {
      revenueTodayPaise: revenueByBucket.get("today") ?? 0,
      revenueYesterdayPaise: revenueByBucket.get("yesterday") ?? 0,
      enrollmentsToday: enrollmentsByBucket.get("today") ?? 0,
      enrollmentsYesterday: enrollmentsByBucket.get("yesterday") ?? 0,
      expiringIn14d: Number(expiring.window_14d) || 0,
      expiringIn7d: Number(expiring.window_7d) || 0,
      expiringIn3d: Number(expiring.window_3d) || 0,
      frozenNow: Number(frozen.frozen_now) || 0,
      resumingIn7d: 0,
    },
    expiringSoon: expiringShaped.rows,
    expiringSoonTotal: expiringShaped.total,
    recentlyExpired: expiredShaped.rows,
    recentlyExpiredTotal: expiredShaped.total,
    enrolledToday: enrolledTodayShaped,
    enrolledTodayTotal: enrolledTotal,
  };
}

