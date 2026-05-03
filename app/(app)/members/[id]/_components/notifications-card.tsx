"use client";

import { ArrowRight, CheckCircle2, Clock, RotateCw, XCircle } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";
import { EVENT_TYPE_LABEL } from "@/lib/notifications/templates";
import { resendNotification } from "@/server/actions/notifications/resend";
import type { MemberNotificationRow } from "@/server/queries/notifications/list-by-member";

type Props = {
  memberId: string;
  rows: MemberNotificationRow[];
  /** True when more rows exist beyond the preview — drives the "View all" link. */
  hasMore: boolean;
  canResend: boolean;
};

const STATUS_ICON = {
  delivered: { Icon: CheckCircle2, className: "text-emerald-600" },
  sent: { Icon: CheckCircle2, className: "text-emerald-600" },
  pending: { Icon: Clock, className: "text-amber-600" },
  failed: { Icon: XCircle, className: "text-destructive" },
} as const;

const STATUS_LABEL = {
  delivered: "Delivered",
  sent: "Sent",
  pending: "Queued",
  failed: "Failed",
} as const;

export function NotificationsCard({ memberId, rows, hasMore, canResend }: Props) {
  if (rows.length === 0) return null;

  return (
    <section
      data-slot="card"
      className="bg-gradient-to-t from-primary/5 to-card text-card-foreground ring-foreground/10 dark:bg-card overflow-hidden rounded-xl ring-1 shadow-xs"
    >
      <header className="flex items-baseline justify-between gap-2 px-5 pt-4 pb-2">
        <h2 className="text-foreground text-sm font-semibold tracking-tight">
          Notifications
        </h2>
        {hasMore ? (
          <Link
            href={`/members/${memberId}/notifications`}
            className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
          >
            View all
            <ArrowRight className="size-3.5" />
          </Link>
        ) : null}
      </header>
      <ul className="divide-border divide-y">
        {rows.slice(0, 5).map((r) => (
          <Row key={r.id} row={r} canResend={canResend} memberId={memberId} />
        ))}
      </ul>
    </section>
  );
}

function Row({
  row,
  canResend,
  memberId,
}: {
  row: MemberNotificationRow;
  canResend: boolean;
  memberId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const status = STATUS_ICON[row.status];
  const StatusIcon = status.Icon;

  function handleResend() {
    startTransition(async () => {
      const result = await resendNotification({
        notificationId: row.id,
        memberId,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Resent — it'll show up in this list shortly.");
    });
  }

  return (
    <li className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <StatusIcon className={cn("size-3.5 shrink-0", status.className)} />
          <p className="text-foreground font-medium">
            {EVENT_TYPE_LABEL[row.eventType]}
          </p>
        </div>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {row.channel.toUpperCase()} · {STATUS_LABEL[row.status]}
          {row.failureReason ? (
            <> · <span className="text-destructive">{row.failureReason}</span></>
          ) : null}
        </p>
        <p className="text-muted-foreground text-[11px]">
          {formatRelative(row.createdAt)}
        </p>
      </div>
      {canResend && row.status === "failed" ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleResend}
          disabled={isPending}
        >
          <RotateCw className={cn("size-3.5", isPending && "animate-spin")} />
          Resend
        </Button>
      ) : null}
    </li>
  );
}
