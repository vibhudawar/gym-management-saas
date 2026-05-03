import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { branches } from "@/lib/db/schema/branches";
import { gyms, type Gym } from "@/lib/db/schema/gyms";
import { members, type Member } from "@/lib/db/schema/members";
import {
  notifications,
  type NotificationEventType,
  type NotificationOutboundChannel,
  type NotificationTriggerEntityType,
} from "@/lib/db/schema/notifications";
import { renderTemplate } from "@/lib/notifications/render-template";
import { templateKeyFor, type TemplateVariables } from "@/lib/notifications/templates";
import { sendNotification } from "./send-notification";

export type DispatchNotificationInput = {
  gymId: string;
  branchId: string;
  memberId: string;
  eventType: NotificationEventType;
  triggerEntityType: NotificationTriggerEntityType;
  triggerEntityId: string;
  templateVars: TemplateVariables;
};

function channelsForGym(gym: Gym): NotificationOutboundChannel[] {
  switch (gym.notificationChannel) {
    case "sms":
      return ["sms"];
    case "whatsapp":
      return ["whatsapp"];
    case "sms+whatsapp":
      return ["sms", "whatsapp"];
  }
}

/**
 * Queue notifications for a member-affecting event. Always called *after* the
 * caller's transaction has committed — dispatch is fire-and-forget from the
 * caller's perspective. Each channel configured on the gym becomes its own
 * `notifications` row so failures stay isolated.
 *
 * The actual provider call is delegated to `sendNotification` and not
 * awaited from the caller; we kick it off in the background so the parent
 * service doesn't block on network IO.
 */
export async function dispatchNotification(
  input: DispatchNotificationInput,
): Promise<void> {
  const [gym] = await db
    .select()
    .from(gyms)
    .where(and(eq(gyms.id, input.gymId), isNull(gyms.deletedAt)))
    .limit(1);
  if (!gym) {
    console.error("dispatchNotification: gym not found", input.gymId);
    return;
  }

  const [member] = (await db
    .select()
    .from(members)
    .where(eq(members.id, input.memberId))
    .limit(1)) as Member[];
  if (!member || !member.phone) {
    // No phone = no receipt possible. Log + bail; not an error.
    console.warn(
      "dispatchNotification: member has no phone, skipping",
      input.memberId,
    );
    return;
  }

  const [branch] = await db
    .select()
    .from(branches)
    .where(eq(branches.id, input.branchId))
    .limit(1);

  // Required template vars include gym/branch name automatically.
  const baseVars: TemplateVariables = {
    gym_name: gym.name,
    branch_name: branch?.name ?? "",
    member_name: member.name,
    ...input.templateVars,
  };

  const templateKey = templateKeyFor(input.eventType);
  const targetChannels = channelsForGym(gym);

  const rowsToSend: Array<{ id: string }> = [];
  for (const channel of targetChannels) {
    let body: string;
    try {
      body = renderTemplate(templateKey, channel, baseVars);
    } catch (err) {
      console.error("dispatchNotification: template render failed", err);
      continue;
    }

    const [inserted] = await db
      .insert(notifications)
      .values({
        gymId: gym.id,
        branchId: input.branchId,
        memberId: member.id,
        eventType: input.eventType,
        triggerEntityType: input.triggerEntityType,
        triggerEntityId: input.triggerEntityId,
        channel,
        recipientPhone: member.phone,
        templateKey,
        messageBody: body,
        provider: gym.notificationProvider,
        status: "pending",
        attemptCount: 0,
      })
      .returning({ id: notifications.id });
    rowsToSend.push({ id: inserted.id });
  }

  // Fire-and-forget the actual sends. We *don't* await — the caller's
  // service should return its API response without waiting on network IO.
  for (const { id } of rowsToSend) {
    void sendNotification(id).catch((err) => {
      console.error("sendNotification failed", id, err);
    });
  }
}
