import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { branches } from "./branches";
import { gyms } from "./gyms";
import { members } from "./members";

export const notificationEventTypes = [
  "enrollment",
  "renewal",
  "refund",
  "correction",
  "cancellation",
] as const;
export type NotificationEventType = (typeof notificationEventTypes)[number];
export const notificationEventTypeEnum = pgEnum(
  "notification_event_type",
  notificationEventTypes,
);

export const notificationTriggerEntityTypes = [
  "membership",
  "payment",
] as const;
export type NotificationTriggerEntityType =
  (typeof notificationTriggerEntityTypes)[number];
export const notificationTriggerEntityTypeEnum = pgEnum(
  "notification_trigger_entity_type",
  notificationTriggerEntityTypes,
);

export const notificationOutboundChannels = ["sms", "whatsapp"] as const;
export type NotificationOutboundChannel =
  (typeof notificationOutboundChannels)[number];
export const notificationOutboundChannelEnum = pgEnum(
  "notification_outbound_channel",
  notificationOutboundChannels,
);

export const notificationStatuses = [
  "pending",
  "sent",
  "delivered",
  "failed",
] as const;
export type NotificationStatus = (typeof notificationStatuses)[number];
export const notificationStatusEnum = pgEnum(
  "notification_status",
  notificationStatuses,
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    gymId: uuid("gym_id")
      .notNull()
      .references(() => gyms.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    eventType: notificationEventTypeEnum("event_type").notNull(),
    triggerEntityType:
      notificationTriggerEntityTypeEnum("trigger_entity_type").notNull(),
    triggerEntityId: uuid("trigger_entity_id").notNull(),
    channel: notificationOutboundChannelEnum("channel").notNull(),
    /** E.164 snapshot of member.phone at the time of dispatch. */
    recipientPhone: text("recipient_phone").notNull(),
    /** Identifier of the rendered template (e.g. `receipt_enrollment_v1`). */
    templateKey: text("template_key").notNull(),
    /** The actual rendered body — kept for audit/replay. */
    messageBody: text("message_body").notNull(),
    provider: text("provider").notNull(), // 'stub' | 'msg91' (kept text for forward-compat)
    providerMessageId: text("provider_message_id"),
    status: notificationStatusEnum("status").notNull().default("pending"),
    failureReason: text("failure_reason"),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("notifications_member_idx").on(
      table.gymId,
      table.memberId,
      table.createdAt.desc(),
    ),
    index("notifications_provider_msg_idx").on(table.providerMessageId),
    index("notifications_gym_created_idx").on(
      table.gymId,
      table.createdAt.desc(),
    ),
    check(
      "notifications_attempts_chk",
      sql`${table.attemptCount} >= 0 and ${table.attemptCount} <= 5`,
    ),
  ],
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
