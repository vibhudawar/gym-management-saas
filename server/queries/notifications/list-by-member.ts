import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  notifications,
  type NotificationEventType,
  type NotificationOutboundChannel,
  type NotificationStatus,
} from "@/lib/db/schema/notifications";
import { requireUser } from "@/lib/auth/get-session";

export type MemberNotificationRow = {
  id: string;
  eventType: NotificationEventType;
  channel: NotificationOutboundChannel;
  recipientPhone: string;
  status: NotificationStatus;
  failureReason: string | null;
  attemptCount: number;
  messageBody: string;
  templateKey: string;
  provider: string;
  providerMessageId: string | null;
  triggerEntityId: string;
  sentAt: Date | null;
  createdAt: Date;
};

/**
 * Notifications for a specific member, newest first. The card uses the first
 * 5; the full log page uses everything (we return up to 200 to keep the
 * client payload bounded).
 */
export async function listNotificationsByMember(
  memberId: string,
  limit = 200,
): Promise<MemberNotificationRow[]> {
  const session = await requireUser();
  return db
    .select({
      id: notifications.id,
      eventType: notifications.eventType,
      channel: notifications.channel,
      recipientPhone: notifications.recipientPhone,
      status: notifications.status,
      failureReason: notifications.failureReason,
      attemptCount: notifications.attemptCount,
      messageBody: notifications.messageBody,
      templateKey: notifications.templateKey,
      provider: notifications.provider,
      providerMessageId: notifications.providerMessageId,
      triggerEntityId: notifications.triggerEntityId,
      sentAt: notifications.sentAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(
      and(
        eq(notifications.gymId, session.gym.id),
        eq(notifications.memberId, memberId),
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}
