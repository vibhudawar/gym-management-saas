import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { gyms } from "./gyms";

export const branches = pgTable(
  "branches",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    gymId: uuid("gym_id")
      .notNull()
      .references(() => gyms.id, { onDelete: "restrict" }),
    name: text("name").notNull().default("Main Branch"),
    address: text("address"),
    phone: text("phone"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [index("branches_gym_active_idx").on(table.gymId, table.isActive)],
);

export type Branch = typeof branches.$inferSelect;
export type NewBranch = typeof branches.$inferInsert;

const e164 = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{1,14}$/, "Phone must be E.164 (e.g. +919876543210)");

export const branchCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  address: z.string().trim().max(400).optional().nullable(),
  phone: e164.optional().nullable(),
  isActive: z.boolean().optional(),
});

export const branchUpdateSchema = branchCreateSchema.partial();
