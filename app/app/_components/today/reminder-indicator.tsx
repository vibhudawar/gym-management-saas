import { formatRelative } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";

type Props = {
  sentAt: Date | null;
  /** Snapshot time — passed from the parent so freshness math is pure. */
  asOf: Date;
};

/**
 * Small dot + relative time indicator under each action row. "Just now" /
 * "today" lights green; older reminders amber; never-contacted is neutral.
 */
export function ReminderIndicator({ sentAt, asOf }: Props) {
  if (!sentAt) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
        <span className="bg-muted-foreground/40 size-1.5 rounded-full" />
        Not contacted yet
      </span>
    );
  }

  const minutesAgo =
    (new Date(asOf).getTime() - new Date(sentAt).getTime()) / 60_000;
  const isFresh = minutesAgo < 60 * 24; // last 24h
  const dot = isFresh ? "bg-emerald-500" : "bg-amber-500";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs",
        isFresh ? "text-emerald-700" : "text-amber-700",
      )}
    >
      <span className={cn("size-1.5 rounded-full", dot)} />
      Reminded {formatRelative(sentAt)}
    </span>
  );
}
