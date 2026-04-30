"use server";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema/members";
import { requireRole } from "@/lib/auth/get-session";

/**
 * Returns the set of E.164 phones currently in use in the user's gym.
 * Used by the CSV import wizard to flag duplicate-phone rows in the preview.
 */
export async function listMemberPhones(): Promise<string[]> {
  const session = await requireRole("owner", "branch_manager");
  const rows = await db
    .select({ phone: members.phone })
    .from(members)
    .where(
      and(eq(members.gymId, session.gym.id), isNull(members.deletedAt)),
    );
  return rows.map((r) => r.phone);
}
