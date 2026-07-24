"use client";

import { Loader2, Send } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sendTestNotification } from "@/server/actions/notifications/send-test";

export function TestMessageButton() {
  const [isPending, startTransition] = useTransition();
  function handleClick() {
    startTransition(async () => {
      const result = await sendTestNotification();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Test ${result.channel.toUpperCase()} sent.`);
    });
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
    >
      {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
      Send test message
    </Button>
  );
}
