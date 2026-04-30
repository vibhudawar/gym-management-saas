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

export const addOnTypes = ["one_time", "recurring"] as const;
export type AddOnType = (typeof addOnTypes)[number];

export const addOnTypeEnum = pgEnum("add_on_type", addOnTypes);

export const addOns = pgTable(
  "add_ons",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    gymId: uuid("gym_id")
      .notNull()
      .references(() => gyms.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    amountPaise: integer("amount_paise").notNull(),
    type: addOnTypeEnum("type").notNull(),
    autoApplyOnFirstEnrollment: boolean("auto_apply_on_first_enrollment")
      .notNull()
      .default(false),
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
    index("add_ons_gym_active_idx").on(table.gymId, table.isActive),
    uniqueIndex("add_ons_gym_name_unique")
      .on(table.gymId, sql`lower(${table.name})`)
      .where(sql`${table.deletedAt} is null`),
    check("add_ons_amount_non_negative", sql`${table.amountPaise} >= 0`),
  ],
);

export type AddOn = typeof addOns.$inferSelect;
export type NewAddOn = typeof addOns.$inferInsert;

const AMOUNT_MAX_PAISE = 10_000_000; // ₹1,00,000 cap per spec

export const addOnCreateSchema = z.object({
  name: z.string().trim().min(2).max(60),
  amountPaise: z.number().int().min(0).max(AMOUNT_MAX_PAISE),
  type: z.enum(addOnTypes),
  autoApplyOnFirstEnrollment: z.boolean().optional().default(false),
  description: z
    .string()
    .trim()
    .max(140)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v)),
});

export const addOnUpdateSchema = addOnCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type AddOnCreateInput = z.infer<typeof addOnCreateSchema>;
export type AddOnUpdateInput = z.infer<typeof addOnUpdateSchema>;
