"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import type { NotificationChannelConfig } from "@/lib/db/schema/gyms";
import { cn } from "@/lib/utils";
import { updateNotificationChannel } from "@/server/actions/settings/update-notification-channel";

type Props = {
  current: NotificationChannelConfig;
  isPro: boolean;
};

const OPTIONS: Array<{
  value: NotificationChannelConfig;
  title: string;
  proOnly: boolean;
}> = [
  { value: "sms", title: "SMS only", proOnly: false },
  { value: "whatsapp", title: "WhatsApp only", proOnly: true },
  { value: "sms+whatsapp", title: "SMS + WhatsApp", proOnly: true },
];

const SUPPORT_EMAIL = "support@example.com";

export function ChannelSelector({ current, isPro }: Props) {
  const [value, setValue] = useState<NotificationChannelConfig>(current);
  const [isPending, startTransition] = useTransition();

  function handleChange(next: string) {
    const v = next as NotificationChannelConfig;
    if (v === value) return;
    const option = OPTIONS.find((o) => o.value === v);
    if (option?.proOnly && !isPro) return; // RadioGroupItem is disabled too
    setValue(v);
    startTransition(async () => {
      const result = await updateNotificationChannel({ channel: v });
      if (!result.ok) {
        setValue(current);
        toast.error(result.error);
        return;
      }
      toast.success("Notification channel updated.");
    });
  }

  return (
    <RadioGroup
      value={value}
      onValueChange={handleChange}
      className="space-y-2"
    >
      {OPTIONS.map((opt) => {
        const disabled = opt.proOnly && !isPro;
        return (
          <Label
            key={opt.value}
            htmlFor={`channel-${opt.value}`}
            className={cn(
              "border-border hover:bg-muted/30 flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition-colors",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <RadioGroupItem
              id={`channel-${opt.value}`}
              value={opt.value}
              disabled={disabled || isPending}
              className="mt-0.5"
            />
            <div className="min-w-0 flex-1">
              <p className="text-foreground font-medium">{opt.title}</p>
              {opt.proOnly && !isPro ? (
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Pro tier ·{" "}
                  <a
                    href={`mailto:${SUPPORT_EMAIL}?subject=Upgrade%20to%20Pro`}
                    className="text-primary hover:underline"
                  >
                    Contact us to upgrade
                  </a>
                </p>
              ) : opt.proOnly ? (
                <Badge variant="secondary" className="mt-1 text-[10px]">
                  Pro
                </Badge>
              ) : null}
            </div>
            {isPending && value === opt.value ? (
              <Loader2 className="text-muted-foreground size-3.5 animate-spin" />
            ) : null}
          </Label>
        );
      })}
    </RadioGroup>
  );
}
