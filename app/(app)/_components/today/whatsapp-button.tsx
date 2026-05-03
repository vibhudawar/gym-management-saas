"use client";

import { MessageCircle } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  buildReminderTemplate,
  buildWhatsAppUrl,
  type ReminderTemplateKind,
} from "@/lib/notifications/whatsapp-reminders";
import { recordReminder } from "@/server/actions/reminders/record-reminder";

type Props = {
  kind: ReminderTemplateKind;
  memberId: string;
  membershipId: string;
  memberName: string;
  memberPhone: string;
  planName: string;
  endDate: string;
  daysFromToday: number;
  gymName: string;
  branchName: string;
};

/**
 * Opens WhatsApp Web in a new tab AND fires-and-forgets a reminder row so the
 * row's status indicator flips to "Reminded just now" on the next refresh.
 * The action runs through `useTransition` so the click stays optimistic; if
 * the server call fails we surface a toast but don't block the user (the
 * WhatsApp tab is already open at that point).
 */
export function WhatsAppButton({
  kind,
  memberId,
  membershipId,
  memberName,
  memberPhone,
  planName,
  endDate,
  daysFromToday,
  gymName,
  branchName,
}: Props) {
  const [isPending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    // Browser opens the link itself — we only need the side effect.
    void e;
    startTransition(async () => {
      const result = await recordReminder({
        memberId,
        membershipId,
        channel: "whatsapp_manual",
      });
      if (!result.ok) {
        toast.error(`Could not log reminder: ${result.error}`);
      }
    });
  }

  const message = buildReminderTemplate(kind, {
    memberName,
    planName,
    endDate,
    daysFromToday,
    gymName,
    branchName,
  });
  const url = buildWhatsAppUrl(memberPhone, message);

  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-700 h-8"
      disabled={isPending}
    >
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        aria-label="Open WhatsApp"
      >
        <MessageCircle className="size-3.5" />
        WhatsApp
      </a>
    </Button>
  );
}
