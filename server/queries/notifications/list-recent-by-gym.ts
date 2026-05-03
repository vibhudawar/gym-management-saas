import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema/members";
import {
  notifications,
  type NotificationEventType,
  type NotificationOutboundChannel,
  type NotificationStatus,
} from "@/lib/db/schema/notifications";
import { requireUser } from "@/lib/auth/get-session";

export type RecentNotificationRow = {
  id: string;
  memberId: string;
  memberName: string | null;
  eventType: NotificationEventType;
  channel: NotificationOutboundChannel;
  status: NotificationStatus;
  failureReason: string | null;
  recipientPhone: string;
  createdAt: Date;
};

export type GymNotificationStats = {
  last7Days: {
    total: number;
    sent: number;
    delivered: number;
    failed: number;
  };
};

export async function listRecentNotificationsByGym(
  limit = 20,
): Promise<RecentNotificationRow[]> {
  const session = await requireUser();
  const rows = await db
    .select({
      id: notifications.id,
      memberId: notifications.memberId,
      memberName: members.name,
      eventType: notifications.eventType,
      channel: notifications.channel,
      status: notifications.status,
      failureReason: notifications.failureReason,
      recipientPhone: notifications.recipientPhone,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .leftJoin(members, eq(members.id, notifications.memberId))
    .where(eq(notifications.gymId, session.gym.id))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  return rows;
}

export async function getNotificationStats(): Promise<GymNotificationStats> {
  const session = await requireUser();
  type Row = { total: number; sent: number; delivered: number; failed: number };
  const rows = (await db.execute<Row>(sql`
    select
      count(*)::int as total,
      count(*) filter (where status = 'sent')::int as sent,
      count(*) filter (where status = 'delivered')::int as delivered,
      count(*) filter (where status = 'failed')::int as failed
    from notifications
    where gym_id = ${session.gym.id}::uuid
      and created_at >= now() - interval '7 days'
  `)) as unknown as Row[];
  const r = rows[0] ?? { total: 0, sent: 0, delivered: 0, failed: 0 };
  return {
    last7Days: {
      total: Number(r.total) || 0,
      sent: Number(r.sent) || 0,
      delivered: Number(r.delivered) || 0,
      failed: Number(r.failed) || 0,
    },
  };
}

