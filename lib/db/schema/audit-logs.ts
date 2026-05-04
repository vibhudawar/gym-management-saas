import {
  bigserial,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { branches } from "./branches";
import { gyms } from "./gyms";
import { users } from "./users";

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    gymId: uuid("gym_id")
      .notNull()
      .references(() => gyms.id, { onDelete: "restrict" }),
    /**
     * Denormalized branch scope for fast filtering. Null for gym-level
     * entities (plans, add-ons, gym profile) — Branch Manager RLS allows
     * those through but the UI hides them. See § 8.2.
     */
    branchId: uuid("branch_id").references(() => branches.id, {
      onDelete: "restrict",
    }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    action: text("action").notNull(),
    beforeJson: jsonb("before_json"),
    afterJson: jsonb("after_json"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_logs_gym_created_idx").on(table.gymId, table.createdAt),
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  ],
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
