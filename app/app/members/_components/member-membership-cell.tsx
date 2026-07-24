import type { MembershipStatus } from "@/lib/db/schema/memberships";
import { formatCalendarDate } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";

const EXPIRING_WINDOW_DAYS = 14;

type Props = {
  status: MembershipStatus | null;
  endDate: string | null;
  planName: string | null;
  dense?: boolean;
};

function daysFromTodayTo(iso: string): number {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const target = new Date(`${iso}T00:00:00Z`);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function MemberMembershipCell({
  status,
  endDate,
  planName,
  dense,
}: Props) {
  if (!status) {
    return (
      <div className="flex items-center gap-2">
        <span className="bg-muted-foreground/30 size-1.5 rounded-full" />
        <span className="text-muted-foreground text-xs">No plan</span>
      </div>
    );
  }

  const isExpiringSoon =
    status === "active" &&
    endDate !== null &&
    daysFromTodayTo(endDate) <= EXPIRING_WINDOW_DAYS;

  const dot = isExpiringSoon
    ? "bg-amber-500"
    : status === "active"
      ? "bg-emerald-500"
      : status === "expired"
        ? "bg-destructive"
        : status === "frozen"
          ? "bg-amber-500"
          : "bg-muted-foreground/40";

  const label = isExpiringSoon
    ? "Expiring"
    : status === "active"
      ? "Active"
      : status === "expired"
        ? "Expired"
        : status === "frozen"
          ? "Frozen"
          : "Cancelled";

  const subtitle = (() => {
    if (status === "cancelled") return null;
    if (!endDate) return null;
    const days = daysFromTodayTo(endDate);
    if (status === "active") {
      if (days < 0) return null;
      const sub = `Ends in ${days} day${days === 1 ? "" : "s"}`;
      return `${sub} · ${formatCalendarDate(endDate)}`;
    }
    if (status === "expired") {
      const ago = Math.abs(days);
      return `Expired ${ago} day${ago === 1 ? "" : "s"} ago · ${formatCalendarDate(endDate)}`;
    }
    if (status === "frozen") {
      return `Resumes ${formatCalendarDate(endDate)}`;
    }
    return null;
  })();

  if (dense) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className={cn("size-1.5 rounded-full", dot)} />
        <span className="text-foreground">{label}</span>
        {planName ? <span className="text-muted-foreground">· {planName}</span> : null}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2 text-sm">
        <span className={cn("size-1.5 rounded-full", dot)} />
        <span className="text-foreground font-medium">{label}</span>
        {planName ? (
          <span className="text-muted-foreground">· {planName}</span>
        ) : null}
      </div>
      {subtitle ? (
        <p className="text-muted-foreground pl-3.5 text-xs">{subtitle}</p>
      ) : null}
    </div>
  );
}
