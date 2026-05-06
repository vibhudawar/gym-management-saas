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
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { branches } from "./branches";
import { gyms } from "./gyms";
import { members } from "./members";
import { memberships } from "./memberships";
import { users } from "./users";

export const paymentModes = ["cash", "upi", "card", "bank_transfer"] as const;
export type PaymentMode = (typeof paymentModes)[number];

export const paymentKinds = ["payment", "refund"] as const;
export type PaymentKind = (typeof paymentKinds)[number];

export const paymentModeEnum = pgEnum("payment_mode", paymentModes);
export const paymentKindEnum = pgEnum("payment_kind", paymentKinds);

export const payments = pgTable(
  "payments",
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
    amountPaise: integer("amount_paise").notNull(),
    paymentMode: paymentModeEnum("payment_mode").notNull(),
    paymentDate: date("payment_date").notNull(),
    invoiceNumber: text("invoice_number").notNull(),
    kind: paymentKindEnum("kind").notNull().default("payment"),
    refundOfPaymentId: uuid("refund_of_payment_id").references(
      (): AnyPgColumn => payments.id,
      { onDelete: "restrict" },
    ),
    reason: text("reason"),
    notes: text("notes"),
    receivedByUserId: uuid("received_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    correctedAt: timestamp("corrected_at", { withTimezone: true }),
    correctedByUserId: uuid("corrected_by_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
    correctionCount: integer("correction_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    // Date-range scans drive the revenue / payments / today queries; every
    // caller filters to `deleted_at IS NULL`, so a partial index excludes
    // the soft-deleted rows from the structure entirely. Mirrors the
    // pattern already used on `memberships_gym_end_date_idx` and the
    // unique-invoice index below.
    index("payments_gym_date_idx")
      .on(table.gymId, table.paymentDate)
      .where(sql`${table.deletedAt} is null`),
    index("payments_gym_branch_date_idx")
      .on(table.gymId, table.branchId, table.paymentDate)
      .where(sql`${table.deletedAt} is null`),
    index("payments_membership_idx").on(table.membershipId),
    index("payments_member_date_idx").on(table.memberId, table.paymentDate),
    uniqueIndex("payments_invoice_unique")
      .on(table.gymId, table.invoiceNumber)
      .where(sql`${table.deletedAt} is null`),
    check(
      "payments_sign_invariant",
      sql`(${table.kind} = 'payment' and ${table.amountPaise} > 0) or (${table.kind} = 'refund' and ${table.amountPaise} < 0)`,
    ),
    check(
      "payments_refund_link",
      sql`(${table.kind} = 'refund') = (${table.refundOfPaymentId} is not null)`,
    ),
  ],
);

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
