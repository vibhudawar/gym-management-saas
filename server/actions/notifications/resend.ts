"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema/notifications";
import { requireRole } from "@/lib/auth/get-session";
import { sendNotification } from "@/server/services/send-notification";

const inputSchema = z.object({
  notificationId: z.string().uuid(),
  memberId: z.string().uuid().optional(),
});

type Result = { ok: true } | { ok: false; error: string };

/**
 * Owner-only resend: clones the failed notification's content into a fresh
 * row and dispatches it. We deliberately don't reuse the failed row — keeping
 * the failure as a separate record protects audit integrity.
 */
export async function resendNotification(input: unknown): Promise<Result> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const session = await requireRole("owner");

  const [original] = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.id, parsed.data.notificationId),
        eq(notifications.gymId, session.gym.id),
      ),
    )
    .limit(1);
  if (!original) {
    return { ok: false, error: "Notification not found." };
  }

  const [clone] = await db
    .insert(notifications)
    .values({
      gymId: original.gymId,
      branchId: original.branchId,
      memberId: original.memberId,
      eventType: original.eventType,
      triggerEntityType: original.triggerEntityType,
      triggerEntityId: original.triggerEntityId,
      channel: original.channel,
      recipientPhone: original.recipientPhone,
      templateKey: original.templateKey,
      messageBody: original.messageBody,
      provider: original.provider,
      status: "pending",
      attemptCount: 0,
    })
    .returning({ id: notifications.id });

  void sendNotification(clone.id).catch((err) => {
    console.error("resend sendNotification failed", clone.id, err);
  });

  if (parsed.data.memberId) {
    revalidatePath(`/app/members/${parsed.data.memberId}`);
    revalidatePath(`/app/members/${parsed.data.memberId}/notifications`);
  }
  revalidatePath("/app/settings/notifications");
  return { ok: true };
}
