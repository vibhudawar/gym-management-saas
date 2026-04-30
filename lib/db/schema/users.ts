import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { branches } from "./branches";
import { gyms } from "./gyms";

export const userRoleEnum = pgEnum("user_role", [
  "owner",
  "branch_manager",
  "receptionist",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    authUserId: uuid("auth_user_id").notNull(),
    gymId: uuid("gym_id")
      .notNull()
      .references(() => gyms.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id").references(() => branches.id, {
      onDelete: "restrict",
    }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    role: userRoleEnum("role").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("users_auth_user_id_uq").on(table.authUserId),
    index("users_gym_idx").on(table.gymId),
    check(
      "users_branch_required_for_non_owner",
      sql`${table.role} = 'owner' OR ${table.branchId} IS NOT NULL`,
    ),
  ],
);

export type Role = (typeof userRoleEnum.enumValues)[number];
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

const e164 = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{1,14}$/, "Phone must be E.164 (e.g. +919876543210)");

export const userCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(180),
    phone: e164.optional().nullable(),
    role: z.enum(["owner", "branch_manager", "receptionist"]),
    branchId: z.string().uuid().optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => d.role === "owner" || !!d.branchId, {
    path: ["branchId"],
    message: "Branch is required for non-owner roles",
  });

export const userUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email().max(180).optional(),
    phone: e164.optional().nullable(),
    branchId: z.string().uuid().optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .partial();
