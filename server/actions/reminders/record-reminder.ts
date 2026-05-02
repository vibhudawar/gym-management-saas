"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema/members";
import { memberships } from "@/lib/db/schema/memberships";
import {
  reminders,
  reminderChannels,
  type ReminderType,
} from "@/lib/db/schema/reminders";
import { requireUser } from "@/lib/auth/get-session";
import { isManagerOrOwner } from "@/lib/auth/roles";

const inputSchema = z.object({
  memberId: z.string().uuid(),
  membershipId: z.string().uuid(),
  channel: z.enum(["whatsapp_manual", "manual"]),
  notes: z.string().trim().max(500).optional(),
});

type Result = { ok: true } | { ok: false; error: string; code?: string };

/**
 * Record that the current user contacted a member about an
 * expiring/expired membership. Type is derived server-side from the
 * membership's days-to-expiry, so the client can't fake which bucket the
 * reminder belongs to.
 */
export async function recordReminder(input: unknown): Promise<Result> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      code: "validation",
    };
  }

  const session = await requireUser();

  const [row] = await db
    .select({
      memberBranchId: members.branchId,
      endDate: memberships.endDate,
      gymId: memberships.gymId,
    })
    .from(memberships)
    .innerJoin(members, eq(members.id, memberships.memberId))
    .where(
      and(
        eq(memberships.id, parsed.data.membershipId),
        eq(memberships.memberId, parsed.data.memberId),
        eq(memberships.gymId, session.gym.id),
        isNull(memberships.deletedAt),
      ),
    )
    .limit(1);

  if (!row) {
    return { ok: false, error: "Membership not found.", code: "not_found" };
  }

  // Receptionist + branch_manager are scoped to their own branch.
  if (
    !isManagerOrOwner(session.user.role) ||
    session.user.role === "branch_manager"
  ) {
    if (
      session.user.branchId &&
      row.memberBranchId !== session.user.branchId
    ) {
      return {
        ok: false,
        error: "Member is in a different branch.",
        code: "branch_forbidden",
      };
    }
  }

  // Days-to-expiry, IST-anchored. Negative when the membership has already lapsed.
  const [{ days_from_today: daysFromToday }] = (await db.execute<{
    days_from_today: number;
  }>(
    sql`select (${row.endDate}::date - (now() at time zone 'Asia/Kolkata')::date)::int as days_from_today`,
  )) as unknown as Array<{ days_from_today: number }>;

  const type: ReminderType = (() => {
    const d = Number(daysFromToday);
    if (d >= 0) {
      if (d <= 3) return "renewal_3d";
      if (d <= 7) return "renewal_7d";
      return "renewal_14d";
    }
    const lapsed = -d;
    if (lapsed <= 7) return "lapsed_7d";
    return "lapsed_30d";
  })();

  if (!reminderChannels.includes(parsed.data.channel)) {
    return { ok: false, error: "Invalid channel.", code: "validation" };
  }

  await db.insert(reminders).values({
    gymId: session.gym.id,
    memberId: parsed.data.memberId,
    membershipId: parsed.data.membershipId,
    type,
    channel: parsed.data.channel,
    status: "contacted",
    notes: parsed.data.notes ?? null,
    createdByUserId: session.user.id,
  });

  // Refresh today's view so the row's reminder indicator updates on next paint.
  revalidatePath("/");
  return { ok: true };
}
