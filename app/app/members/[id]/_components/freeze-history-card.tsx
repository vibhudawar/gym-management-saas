import { Pause } from "lucide-react";
import { formatCalendarDate, formatDateTime } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";
import type { FreezeHistoryRow } from "@/server/queries/freezes/get-freezes-by-membership";

type Props = {
  rows: FreezeHistoryRow[];
};

const STATUS_DOT: Record<FreezeHistoryRow["effectiveStatus"], string> = {
  active: "bg-amber-500",
  scheduled: "bg-amber-500",
  completed: "bg-muted-foreground/40",
  cancelled_early: "bg-muted-foreground/30",
};

const STATUS_LABEL: Record<FreezeHistoryRow["effectiveStatus"], string> = {
  active: "Active",
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled_early: "Cancelled early",
};

export function FreezeHistoryCard({ rows }: Props) {
  if (rows.length === 0) return null;

  return (
    <section
      data-slot="card"
      className="bg-gradient-to-t from-primary/5 to-card text-card-foreground ring-foreground/10 dark:bg-card overflow-hidden rounded-xl ring-1 shadow-xs"
    >
      <header className="flex items-center justify-between gap-2 px-5 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <Pause className="text-muted-foreground size-3.5" />
          <h2 className="text-foreground text-sm font-semibold tracking-tight">
            Freeze history
          </h2>
        </div>
        <span className="text-muted-foreground tabular-nums text-xs">
          {rows.length}
        </span>
      </header>
      <ul className="divide-border divide-y">
        {rows.map((r) => {
          const isCancelled = r.effectiveStatus === "cancelled_early";
          return (
            <li key={r.id} className="px-5 py-3 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      STATUS_DOT[r.effectiveStatus],
                    )}
                  />
                  <span
                    className={cn(
                      "text-foreground text-xs font-medium",
                      isCancelled && "line-through text-muted-foreground",
                    )}
                  >
                    {STATUS_LABEL[r.effectiveStatus]}
                  </span>
                </div>
                <span className="text-muted-foreground tabular-nums text-xs">
                  {isCancelled ? (
                    <>
                      {r.daysAdded} day{r.daysAdded === 1 ? "" : "s"} used
                    </>
                  ) : (
                    <>
                      {r.daysAdded} day{r.daysAdded === 1 ? "" : "s"}
                    </>
                  )}
                </span>
              </div>
              <p className="text-foreground mt-0.5 text-xs">
                {formatCalendarDate(r.freezeStartDate)} →{" "}
                {formatCalendarDate(
                  r.actualEndDate ?? r.freezeEndDate,
                )}
              </p>
              {isCancelled && r.actualEndDate ? (
                <p className="text-muted-foreground text-[10px]">
                  Originally ended {formatCalendarDate(r.freezeEndDate)}
                </p>
              ) : null}
              <p className="text-foreground/80 mt-1 text-xs">
                &ldquo;{r.reason}&rdquo;
              </p>
              {isCancelled && r.earlyUnfreezeReason ? (
                <p className="text-muted-foreground mt-0.5 text-[11px]">
                  Ended early: {r.earlyUnfreezeReason}
                </p>
              ) : null}
              <p className="text-muted-foreground mt-1 text-[10px]">
                Frozen by {r.createdByName ?? "—"} ·{" "}
                {formatDateTime(r.createdAt)}
                {isCancelled && r.endedByName ? (
                  <> · ended by {r.endedByName}</>
                ) : null}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
