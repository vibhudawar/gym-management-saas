import { sql } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { gyms } from "./gyms";
import { members } from "./members";
import { memberships } from "./memberships";
import { users } from "./users";

export const reminderTypes = [
  "renewal_14d",
  "renewal_7d",
  "renewal_3d",
  "lapsed_7d",
  "lapsed_30d",
  "win_back",
] as const;
export type ReminderType = (typeof reminderTypes)[number];

export const reminderTypeEnum = pgEnum("reminder_type", reminderTypes);

export const reminderChannels = [
  "whatsapp_manual",
  "whatsapp_api",
  "sms",
  "manual",
] as const;
export type ReminderChannel = (typeof reminderChannels)[number];

export const reminderChannelEnum = pgEnum("reminder_channel", reminderChannels);

export const reminderStatuses = [
  "contacted",
  "responded",
  "paid",
  "lapsed",
] as const;
export type ReminderStatus = (typeof reminderStatuses)[number];

export const reminderStatusEnum = pgEnum("reminder_status", reminderStatuses);

export const reminders = pgTable(
  "reminders",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    gymId: uuid("gym_id")
      .notNull()
      .references(() => gyms.id, { onDelete: "restrict" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    membershipId: uuid("membership_id").references(() => memberships.id, {
      onDelete: "restrict",
    }),
    type: reminderTypeEnum("type").notNull(),
    channel: reminderChannelEnum("channel").notNull(),
    status: reminderStatusEnum("status").notNull().default("contacted"),
    notes: text("notes"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    sentAt: timestamp("sent_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("reminders_member_sent_idx").on(table.memberId, table.sentAt.desc()),
    index("reminders_membership_sent_idx").on(
      table.membershipId,
      table.sentAt.desc(),
    ),
    index("reminders_gym_sent_idx").on(table.gymId, table.sentAt.desc()),
  ],
);

export type Reminder = typeof reminders.$inferSelect;
export type NewReminder = typeof reminders.$inferInsert;
