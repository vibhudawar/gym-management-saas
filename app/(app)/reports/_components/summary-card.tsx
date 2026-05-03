import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string;
  subline?: string | null;
  tone?: "default" | "destructive" | "primary";
  /** Optional comparison-line node rendered under the subline. */
  comparison?: React.ReactNode;
};

/**
 * Compact reporting metric card. Same gradient + ring as the dashboard cards
 * for visual cohesion, but no delta badge or footer trend line — reports are
 * declarative, not comparative.
 */
export function SummaryCard({
  label,
  value,
  subline,
  tone = "default",
  comparison,
}: Props) {
  return (
    <div
      data-slot="card"
      className="bg-gradient-to-t from-primary/5 to-card text-card-foreground ring-foreground/10 dark:bg-card rounded-xl p-5 ring-1 shadow-xs"
    >
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tabular-nums tracking-tight",
          tone === "destructive" && "text-destructive",
          tone === "primary" && "text-primary",
        )}
      >
        {value}
      </p>
      {subline ? (
        <p className="text-muted-foreground mt-1 text-xs">{subline}</p>
      ) : null}
      {comparison ? <div className="mt-2">{comparison}</div> : null}
    </div>
  );
}
