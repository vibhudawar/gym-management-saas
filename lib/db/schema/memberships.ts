import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
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
import { plans } from "./plans";
import { users } from "./users";

export const membershipStatuses = [
  "active",
  "expired",
  "frozen",
  "cancelled",
] as const;
export type MembershipStatus = (typeof membershipStatuses)[number];

export const membershipStatusEnum = pgEnum("membership_status", membershipStatuses);

export const memberships = pgTable(
  "memberships",
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
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    originalEndDate: date("original_end_date").notNull(),
    planPricePaise: integer("plan_price_paise").notNull(),
    addonsTotalPaise: integer("addons_total_paise").notNull().default(0),
    discountPaise: integer("discount_paise").notNull().default(0),
    discountReason: text("discount_reason"),
    finalAmountPaise: integer("final_amount_paise").notNull(),
    status: membershipStatusEnum("status").notNull().default("active"),
    previousMembershipId: uuid("previous_membership_id").references(
      (): AnyPgColumn => memberships.id,
      { onDelete: "set null" },
    ),
    enrolledByUserId: uuid("enrolled_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    correctedAt: timestamp("corrected_at", { withTimezone: true }),
    correctedByUserId: uuid("corrected_by_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
    correctionCount: integer("correction_count").notNull().default(0),
    cancellationReason: text("cancellation_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("memberships_member_status_idx").on(
      table.gymId,
      table.memberId,
      table.status,
    ),
    index("memberships_gym_branch_status_idx").on(
      table.gymId,
      table.branchId,
      table.status,
    ),
    index("memberships_member_created_idx").on(table.memberId, table.createdAt),
    index("memberships_gym_end_date_idx")
      .on(table.gymId, table.endDate)
      .where(sql`${table.status} = 'active' and ${table.deletedAt} is null`),
    check(
      "memberships_end_after_start",
      sql`${table.endDate} >= ${table.startDate}`,
    ),
    check(
      "memberships_final_non_negative",
      sql`${table.finalAmountPaise} >= 0`,
    ),
    check(
      "memberships_discount_non_negative",
      sql`${table.discountPaise} >= 0`,
    ),
    check("memberships_plan_price_non_negative", sql`${table.planPricePaise} >= 0`),
    check(
      "memberships_addons_non_negative",
      sql`${table.addonsTotalPaise} >= 0`,
    ),
  ],
);

export type Membership = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;
