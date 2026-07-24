import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ActionRow as ActionRowType } from "@/server/queries/today/get-today-snapshot";
import { ActionListEmpty } from "./action-list-empty";
import { ActionRow } from "./action-row";

type Props = {
  kind: "expiring" | "expired";
  rows: ActionRowType[];
  total: number;
  gymName: string;
  asOf: Date;
};

const COPY = {
  expiring: {
    title: "Expiring soon",
    subtitle: "Next 14 days",
    showAllHref: "/app/members?membership=expiring",
    badge: "bg-amber-500 hover:bg-amber-500 text-white border-transparent",
    emptyMessage: "No memberships ending in the next 14 days.",
  },
  expired: {
    title: "Recently expired",
    subtitle: "Last 30 days",
    showAllHref: "/app/members?membership=expired",
    badge:
      "bg-destructive hover:bg-destructive text-white border-transparent",
    emptyMessage: "No expirations in the last 30 days.",
  },
} as const;

/**
 * Card-style list. Color comes only from the count badge — the card itself
 * uses the same subtle gradient as the metric cards above for visual
 * cohesion. Both action cards stretch to equal heights via `h-full` + a
 * flex-1 body.
 */
export function ActionList({ kind, rows, total, gymName, asOf }: Props) {
  const copy = COPY[kind];
  const hasOverflow = total > rows.length;

  return (
    <section
      data-slot="card"
      className="bg-gradient-to-t from-primary/5 to-card text-card-foreground ring-foreground/10 dark:bg-card flex h-full flex-col overflow-hidden rounded-xl ring-1 shadow-xs"
    >
      <header className="flex items-center justify-between gap-2 px-5 pt-4 pb-2">
        <div>
          <h2 className="text-foreground text-base font-semibold tracking-tight">
            {copy.title}
          </h2>
          <p className="text-muted-foreground text-xs">{copy.subtitle}</p>
        </div>
        {total > 0 ? (
          <Badge className={cn("h-5 px-1.5 text-xs", copy.badge)}>{total}</Badge>
        ) : null}
      </header>

      {rows.length === 0 ? (
        <div className="flex flex-1 items-center">
          <ActionListEmpty message={copy.emptyMessage} />
        </div>
      ) : (
        <>
          <div className="flex-1">
            {rows.map((row) => (
              <ActionRow
                key={row.membershipId}
                row={row}
                kind={kind}
                gymName={gymName}
                asOf={asOf}
              />
            ))}
          </div>
          {hasOverflow ? (
            <div className="border-border/50 border-t px-5 py-3">
              <Link
                href={copy.showAllHref}
                className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
              >
                Show all {total.toLocaleString("en-IN")}
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
