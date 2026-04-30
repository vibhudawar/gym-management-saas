import { sql } from "drizzle-orm";
import { boolean, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod";

export const subscriptionTierEnum = pgEnum("subscription_tier", ["basic", "pro"]);

export const gyms = pgTable("gyms", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  ownerUserId: uuid("owner_user_id"),
  gstNumber: text("gst_number"),
  invoicePrefix: text("invoice_prefix").notNull(),
  invoiceYearReset: boolean("invoice_year_reset").notNull().default(true),
  currency: text("currency").notNull().default("INR"),
  subscriptionTier: subscriptionTierEnum("subscription_tier").notNull().default("basic"),
  whatsappApiEnabled: boolean("whatsapp_api_enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export type Gym = typeof gyms.$inferSelect;
export type NewGym = typeof gyms.$inferInsert;

export const gymCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  gstNumber: z
    .string()
    .trim()
    .regex(/^[0-9A-Z]{15}$/, "Invalid GSTIN")
    .optional()
    .nullable(),
  invoicePrefix: z
    .string()
    .trim()
    .min(1)
    .max(10)
    .regex(/^[A-Z0-9-]+$/, "Use uppercase letters, digits, or hyphens"),
  invoiceYearReset: z.boolean().optional(),
  currency: z.literal("INR").optional(),
  subscriptionTier: z.enum(["basic", "pro"]).optional(),
});

export const gymUpdateSchema = gymCreateSchema.partial();
