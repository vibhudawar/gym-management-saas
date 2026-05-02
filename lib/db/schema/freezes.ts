import { sql } from "drizzle-orm";
import {
  check,
  date,
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
import { memberships } from "./memberships";
import { users } from "./users";

/**
 * Stored freeze states. The system never writes 'completed' — that value is
 * derived at read-time by `freezes_with_status` based on dates. The only
 * terminal state the system writes explicitly is 'cancelled_early'.
 */
export const freezeStatuses = [
  "scheduled",
  "active",
  "completed",
  "cancelled_early",
] as const;
export type FreezeStatus = (typeof freezeStatuses)[number];
export const freezeStatusEnum = pgEnum("freeze_status", freezeStatuses);

export const freezes = pgTable(
  "freezes",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    gymId: uuid("gym_id")
      .notNull()
      .references(() => gyms.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => memberships.id, { onDelete: "restrict" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    freezeStartDate: date("freeze_start_date").notNull(),
    freezeEndDate: date("freeze_end_date").notNull(),
    /**
     * Set when the freeze is unfrozen early. For natural completion this stays
     * null and the freeze_end_date acts as the effective end.
     */
    actualEndDate: date("actual_end_date"),
    /**
     * Days that were *actually* added to memberships.end_date. Revised down on
     * early unfreeze so SUM(days_added) over a membership always equals the
     * total extension applied. See § 6.5.
     */
    daysAdded: integer("days_added").notNull(),
    reason: text("reason").notNull(),
    status: freezeStatusEnum("status").notNull(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    endedByUserId: uuid("ended_by_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    earlyUnfreezeReason: text("early_unfreeze_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("freezes_gym_membership_idx").on(table.gymId, table.membershipId),
    index("freezes_gym_status_idx").on(table.gymId, table.status),
    index("freezes_member_start_idx").on(
      table.memberId,
      table.freezeStartDate.desc(),
    ),
    check(
      "freezes_dates_chk",
      sql`${table.freezeEndDate} >= ${table.freezeStartDate}`,
    ),
    // 0 is allowed for freezes cancelled before they could take effect.
    check("freezes_days_added_chk", sql`${table.daysAdded} >= 0`),
    check(
      "freezes_actual_end_chk",
      sql`(${table.actualEndDate} is null) or (${table.actualEndDate} >= ${table.freezeStartDate})`,
    ),
    check(
      "freezes_cancel_consistency_chk",
      sql`(${table.status} = 'cancelled_early') = (${table.endedByUserId} is not null and ${table.earlyUnfreezeReason} is not null)`,
    ),
  ],
);

export type Freeze = typeof freezes.$inferSelect;
export type NewFreeze = typeof freezes.$inferInsert;
