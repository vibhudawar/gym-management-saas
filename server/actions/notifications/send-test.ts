"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { gyms } from "@/lib/db/schema/gyms";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/get-session";
import { getProvider } from "@/lib/notifications/get-provider";
import type { ProviderName } from "@/lib/notifications/provider";

type Result = { ok: true; channel: string } | { ok: false; error: string };

/**
 * Settings → "Send test message". Sends a fixed test payload to the
 * signed-in owner's own phone via the configured provider. Useful at
 * onboarding to verify the system end-to-end.
 *
 * Note: when the real MSG91 provider is wired, this body must match a
 * DLT-approved test template (per Pitfall #9). For v1 / stub the body
 * is whatever we send here.
 */
export async function sendTestNotification(): Promise<Result> {
  const session = await requireRole("owner");
  if (!session.user.phone) {
    return {
      ok: false,
      error:
        "Add a phone number to your profile first so we know where to send the test.",
    };
  }

  const [gym] = await db
    .select({
      provider: gyms.notificationProvider,
      senderId: gyms.senderId,
      whatsappTemplateNamespace: gyms.whatsappTemplateNamespace,
      name: gyms.name,
      channel: gyms.notificationChannel,
    })
    .from(gyms)
    .where(eq(gyms.id, session.gym.id))
    .limit(1);
  if (!gym) return { ok: false, error: "Gym not found." };

  const channel: "sms" | "whatsapp" = gym.channel === "whatsapp" ? "whatsapp" : "sms";
  const provider = getProvider(gym.provider as ProviderName);
  const body = `Test message from ${gym.name}. If you received this, your notification setup works.`;

  const result = await provider.send({
    to: session.user.phone,
    channel,
    body,
    senderId: gym.senderId,
    whatsappTemplateNamespace: gym.whatsappTemplateNamespace,
  });

  revalidatePath("/settings/notifications");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, channel };
}
