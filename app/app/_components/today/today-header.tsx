"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";

type Props = {
  asOf: Date;
  branchName: string | null;
  dateLabel: string; // "Friday, 1 May 2026" — pre-formatted on the server
};

const STALE_THRESHOLD_MIN = 10;

export function TodayHeader({ asOf, branchName, dateLabel }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Re-render every 30s so "Updated 2 min ago" stays accurate. The actual data
  // is unchanged — this is a pure formatting tick. We re-read the wall clock
  // inside the tick (state, not Date.now during render) to keep render pure.
  const [now, setNow] = useState(() => new Date(asOf).getTime());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  function handleRefresh() {
    startTransition(() => router.refresh());
  }

  const minutesOld = (now - new Date(asOf).getTime()) / 60_000;
  const isStale = minutesOld > STALE_THRESHOLD_MIN;

  return (
    <div className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-foreground text-3xl font-semibold tracking-tight">
          Today
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {dateLabel} · {branchName ?? "All branches"}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <p
          className={cn(
            "text-xs",
            isStale ? "text-amber-700" : "text-muted-foreground",
          )}
        >
          {isStale
            ? `Showing data from ${formatRelative(asOf)}. Refresh?`
            : `Updated ${formatRelative(asOf)}`}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isPending}
          aria-label="Refresh"
        >
          <RefreshCw className={cn("size-3.5", isPending && "animate-spin")} />
          Refresh
        </Button>
      </div>
    </div>
  );
}
