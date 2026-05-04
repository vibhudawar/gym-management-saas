"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  gyms,
  notificationChannels,
  type NotificationChannelConfig,
} from "@/lib/db/schema/gyms";
import { recordAudit } from "@/lib/auth/audit";
import { requireRole } from "@/lib/auth/get-session";

const inputSchema = z.object({
  channel: z.enum(notificationChannels),
});

type Result = { ok: true } | { ok: false; error: string; code?: string };

/**
 * Update the gym's outbound notification channel. WhatsApp options are
 * Pro-tier — basic gyms get a friendly error pointing at the upgrade
 * dialog, even if they bypass the radio's disabled state.
 */
export async function updateNotificationChannel(
  input: unknown,
): Promise<Result> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const session = await requireRole("owner");

  if (
    session.gym.subscriptionTier === "basic" &&
    parsed.data.channel !== "sms"
  ) {
    return {
      ok: false,
      code: "PRO_REQUIRED",
      error: "WhatsApp delivery is available on the Pro plan only.",
    };
  }

  const [before] = await db
    .select()
    .from(gyms)
    .where(eq(gyms.id, session.gym.id))
    .limit(1);
  if (!before) return { ok: false, error: "Gym not found." };

  if (before.notificationChannel === parsed.data.channel) {
    return { ok: true };
  }

  const [after] = await db
    .update(gyms)
    .set({ notificationChannel: parsed.data.channel as NotificationChannelConfig })
    .where(eq(gyms.id, session.gym.id))
    .returning();

  await recordAudit({
    entityType: "gym",
    entityId: after.id,
    branchId: null,
    action: "update",
    before,
    after: {
      ...after,
      _meta: { event: "notification_channel_changed" },
    },
  });

  revalidatePath("/settings/notifications");
  return { ok: true };
}
