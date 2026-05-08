import { and, eq, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema/notifications";
import { sendNotification } from "@/server/services/send-notification";

const BATCH_SIZE = 50;

/**
 * Vercel Cron worker. Runs once a day at 22:00 UTC = 03:30 IST (configured
 * in vercel.json) — Hobby plan limits cron to daily cadence. Bump to
 * `*\/5 * * * *` after upgrading to Pro so failed receipts retry within
 * minutes instead of up to 24h.
 *
 * Picks up notifications whose `next_retry_at` has passed and re-attempts
 * them via `sendNotification`. Authorization is required — there's no
 * dev-mode bypass on purpose; that would let local development trigger
 * retries against production data.
 */
export async function GET(request: Request): Promise<Response> {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return new Response("CRON_SECRET not configured", { status: 503 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${expected}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const due = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.status, "pending"),
        lte(notifications.nextRetryAt, sql`now()`),
      ),
    )
    .limit(BATCH_SIZE);

  await Promise.allSettled(due.map(({ id }) => sendNotification(id)));

  return Response.json({ processed: due.length });
}
