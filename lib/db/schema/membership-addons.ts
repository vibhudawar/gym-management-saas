import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { addOns } from "./add-ons";
import { memberships } from "./memberships";

export const membershipAddons = pgTable(
  "membership_addons",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => memberships.id, { onDelete: "cascade" }),
    addOnId: uuid("add_on_id")
      .notNull()
      .references(() => addOns.id, { onDelete: "restrict" }),
    amountPaise: integer("amount_paise").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("membership_addons_membership_idx").on(table.membershipId),
    check(
      "membership_addons_amount_non_negative",
      sql`${table.amountPaise} >= 0`,
    ),
  ],
);

export type MembershipAddon = typeof membershipAddons.$inferSelect;
export type NewMembershipAddon = typeof membershipAddons.$inferInsert;
