import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
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
import { users } from "./users";
import { phoneSchema, phoneSchemaOptional } from "@/lib/utils/phone";

export const memberGenders = [
  "male",
  "female",
  "other",
  "prefer_not_to_say",
] as const;
export type MemberGender = (typeof memberGenders)[number];

export const memberGenderEnum = pgEnum("member_gender", memberGenders);

export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    gymId: uuid("gym_id")
      .notNull()
      .references(() => gyms.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    gender: memberGenderEnum("gender"),
    dob: date("dob"),
    address: text("address"),
    emergencyContactName: text("emergency_contact_name"),
    emergencyContactPhone: text("emergency_contact_phone"),
    notes: text("notes"),
    joinedDate: date("joined_date").notNull().defaultNow(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("members_gym_phone_unique")
      .on(table.gymId, table.phone)
      .where(sql`${table.deletedAt} is null`),
    index("members_gym_branch_active_idx").on(
      table.gymId,
      table.branchId,
      table.isActive,
    ),
    index("members_gym_idx").on(table.gymId),
    check(
      "members_name_length",
      sql`char_length(${table.name}) between 2 and 80`,
    ),
    check("members_phone_format", sql`${table.phone} ~ '^\\+[1-9]\\d{6,14}$'`),
    check(
      "members_emergency_phone_format",
      sql`${table.emergencyContactPhone} is null or ${table.emergencyContactPhone} ~ '^\\+[1-9]\\d{6,14}$'`,
    ),
    check(
      "members_email_format",
      sql`${table.email} is null or ${table.email} ~* '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'`,
    ),
  ],
);

export type Member = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email")
  .max(120)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v === "" || v === undefined ? null : v));

export const memberCreateSchema = z.object({
  branchId: z.string().uuid("Choose a branch"),
  name: z.string().trim().min(2, "Use at least 2 characters").max(80),
  phone: phoneSchema,
  email: optionalEmail.nullable(),
  gender: z.enum(memberGenders).optional().nullable(),
  dob: isoDate.optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  emergencyContactName: z.string().trim().max(80).optional().nullable(),
  emergencyContactPhone: phoneSchemaOptional.nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  joinedDate: isoDate.optional(),
});

export const memberUpdateSchema = memberCreateSchema.partial();

export type MemberCreateInput = z.infer<typeof memberCreateSchema>;
export type MemberUpdateInput = z.infer<typeof memberUpdateSchema>;
