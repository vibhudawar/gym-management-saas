import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { gyms } from "@/lib/db/schema/gyms";
import { notifications } from "@/lib/db/schema/notifications";
import { getProvider } from "@/lib/notifications/get-provider";
import type { ProviderName } from "@/lib/notifications/provider";

const MAX_ATTEMPTS = 3;
const BASE_RETRY_MINUTES = 5;

/**
 * Performs the actual send for a single `notifications` row, with retry
 * scheduling for retriable failures. Designed to be safe against re-entry —
 * the row is locked FOR UPDATE, and if its status is no longer 'pending'
 * (e.g., another worker grabbed it) we no-op.
 *
 * Called both from `dispatchNotification` (initial send) and from the
 * `/api/cron/retry-notifications` worker (retries).
 */
export async function sendNotification(notificationId: string): Promise<void> {
  type LockResult = {
    id: string;
    gymId: string;
    channel: "sms" | "whatsapp";
    recipientPhone: string;
    messageBody: string;
    provider: string;
    attemptCount: number;
    status: "pending" | "sent" | "delivered" | "failed";
    senderId: string | null;
    whatsappTemplateNamespace: string | null;
  };

  // Fetch + lock + read the gym in one transaction so the provider config
  // doesn't change underneath us.
  const lock: LockResult | null = await db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        id: notifications.id,
        gymId: notifications.gymId,
        channel: notifications.channel,
        recipientPhone: notifications.recipientPhone,
        messageBody: notifications.messageBody,
        provider: notifications.provider,
        attemptCount: notifications.attemptCount,
        status: notifications.status,
      })
      .from(notifications)
      .where(eq(notifications.id, notificationId))
      .for("update")
      .limit(1);
    if (!row || row.status !== "pending") return null;

    const [gym] = await tx
      .select({
        senderId: gyms.senderId,
        whatsappTemplateNamespace: gyms.whatsappTemplateNamespace,
      })
      .from(gyms)
      .where(eq(gyms.id, row.gymId))
      .limit(1);

    await tx
      .update(notifications)
      .set({
        attemptCount: row.attemptCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(notifications.id, row.id));

    return {
      ...row,
      senderId: gym?.senderId ?? null,
      whatsappTemplateNamespace: gym?.whatsappTemplateNamespace ?? null,
    };
  });

  if (!lock) return;

  const provider = getProvider(lock.provider as ProviderName);
  let result;
  try {
    result = await provider.send({
      to: lock.recipientPhone,
      channel: lock.channel,
      body: lock.messageBody,
      senderId: lock.senderId,
      whatsappTemplateNamespace: lock.whatsappTemplateNamespace,
    });
  } catch (err) {
    result = {
      ok: false as const,
      error: err instanceof Error ? err.message : String(err),
      retriable: true,
    };
  }

  if (result.ok) {
    await db
      .update(notifications)
      .set({
        status: "sent",
        providerMessageId: result.providerMessageId,
        sentAt: new Date(),
        nextRetryAt: null,
        failureReason: null,
        updatedAt: new Date(),
      })
      .where(eq(notifications.id, lock.id));
    return;
  }

  const newAttempts = lock.attemptCount + 1;
  if (result.retriable && newAttempts < MAX_ATTEMPTS) {
    // Exponential-ish backoff: 5, 10, 15 minutes after attempts 1, 2, 3.
    const delayMin = BASE_RETRY_MINUTES * newAttempts;
    const nextRetryAt = new Date(Date.now() + delayMin * 60_000);
    await db
      .update(notifications)
      .set({
        status: "pending",
        nextRetryAt,
        failureReason: result.error,
        updatedAt: new Date(),
      })
      .where(eq(notifications.id, lock.id));
    return;
  }

  // Non-retriable, or out of attempts.
  await db
    .update(notifications)
    .set({
      status: "failed",
      failureReason: result.error,
      nextRetryAt: null,
      updatedAt: new Date(),
    })
    .where(eq(notifications.id, lock.id));
}

export const _internals = {
  // Surface for tests / cron worker; not part of the public API.
  pendingDueClause: () =>
    and(
      eq(notifications.status, "pending"),
      sql`${notifications.nextRetryAt} is not null and ${notifications.nextRetryAt} <= now()`,
    ),
};
