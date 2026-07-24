import { ArrowDown, ArrowUp } from "lucide-react";
import { formatMoney, formatMoneyShort } from "@/lib/utils/money";
import { cn } from "@/lib/utils";

type Props = {
  netPaise: number;
  priorNetPaise: number | null;
  deltaPct: number | null;
  direction: "up" | "down" | "flat";
  newMembers: number;
  refundsPaise: number;
  priorLabel: string;
};

export function OverviewHeadline({
  netPaise,
  priorNetPaise,
  deltaPct,
  direction,
  newMembers,
  refundsPaise,
  priorLabel,
}: Props) {
  const hasPrior = priorNetPaise !== null;

  return (
    <section
      data-slot="card"
      className="bg-gradient-to-t from-primary/5 to-card text-card-foreground ring-foreground/10 dark:bg-card relative overflow-hidden rounded-xl p-6 ring-1 shadow-xs"
    >
      <span aria-hidden className="bg-primary absolute inset-y-0 left-0 w-1" />
      <div className="pl-2">
        {hasPrior ? (
          <p
            className={cn(
              "inline-flex items-center gap-1 text-sm font-medium",
              direction === "up" && "text-emerald-700",
              direction === "down" && "text-destructive",
              direction === "flat" && "text-muted-foreground",
            )}
          >
            {direction === "up" ? (
              <ArrowUp className="size-3.5" />
            ) : direction === "down" ? (
              <ArrowDown className="size-3.5" />
            ) : null}
            {direction === "flat" ? (
              <>Same as {priorLabel}</>
            ) : deltaPct === null ? (
              <>
                {direction === "up" ? "↑" : "↓"} from {formatMoneyShort(priorNetPaise ?? 0)}{" "}
                <span className="text-muted-foreground">{priorLabel}</span>
              </>
            ) : (
              <>
                {direction === "up" ? "↑" : "↓"} {Math.abs(deltaPct)}%{" "}
                <span className="text-muted-foreground">{priorLabel}</span>
              </>
            )}
          </p>
        ) : (
          <p className="text-muted-foreground text-sm font-medium">
            Your first period of tracked data
          </p>
        )}
        <p className="text-primary mt-2 text-4xl font-semibold tabular-nums tracking-tight lg:text-5xl">
          {formatMoneyShort(netPaise)}
        </p>
        <p className="text-muted-foreground mt-2 text-sm">
          <span className="text-foreground font-medium">{netPaise > 0 ? formatMoney(netPaise) : formatMoney(0)}</span>{" "}
          net revenue · {newMembers} new {newMembers === 1 ? "enrolment" : "enrolments"}
          {refundsPaise > 0 ? (
            <> · {formatMoneyShort(refundsPaise)} in refunds</>
          ) : null}
        </p>
      </div>
    </section>
  );
}
