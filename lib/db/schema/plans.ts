import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { gyms } from "./gyms";

export const planTypes = ["general", "cardio", "gym_cardio", "custom"] as const;
export type PlanType = (typeof planTypes)[number];

export const planTypeEnum = pgEnum("plan_type", planTypes);

export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    gymId: uuid("gym_id")
      .notNull()
      .references(() => gyms.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    durationDays: integer("duration_days").notNull(),
    type: planTypeEnum("type").notNull(),
    defaultPricePaise: integer("default_price_paise").notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("plans_gym_active_idx").on(table.gymId, table.isActive),
    uniqueIndex("plans_gym_name_unique")
      .on(table.gymId, sql`lower(${table.name})`)
      .where(sql`${table.deletedAt} is null`),
    check("plans_duration_positive", sql`${table.durationDays} > 0`),
    check("plans_price_non_negative", sql`${table.defaultPricePaise} >= 0`),
  ],
);

export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;

const PRICE_MAX_PAISE = 10_000_000; // ₹1,00,000 cap per spec
const NAME_MIN = 2;
const NAME_MAX = 80;
const DURATION_MIN = 1;
const DURATION_MAX = 3650;

export const planCreateSchema = z.object({
  name: z.string().trim().min(NAME_MIN).max(NAME_MAX),
  durationDays: z.number().int().min(DURATION_MIN).max(DURATION_MAX),
  type: z.enum(planTypes),
  defaultPricePaise: z.number().int().min(0).max(PRICE_MAX_PAISE),
  description: z
    .string()
    .trim()
    .max(280)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
});

export const planUpdateSchema = planCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type PlanCreateInput = z.infer<typeof planCreateSchema>;
export type PlanUpdateInput = z.infer<typeof planUpdateSchema>;
