import {
  integer,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { gyms } from "./gyms";

export const invoiceSequences = pgTable(
  "invoice_sequences",
  {
    gymId: uuid("gym_id")
      .notNull()
      .references(() => gyms.id, { onDelete: "restrict" }),
    year: integer("year").notNull(),
    lastSeq: integer("last_seq").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.gymId, table.year] }),
  ],
);

export type InvoiceSequence = typeof invoiceSequences.$inferSelect;
