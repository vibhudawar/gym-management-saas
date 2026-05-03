type Props = {
  label: string;
  primary: string;
  secondary: string;
};

/**
 * Pattern-as-finding card. Each card states one observation in plain English
 * — the system found this so the owner doesn't have to. When the period has
 * too little data for a finding, callers pass "Not enough data yet" rather
 * than fabricating one.
 */
export function HighlightCard({ label, primary, secondary }: Props) {
  return (
    <div
      data-slot="card"
      className="bg-gradient-to-t from-primary/5 to-card text-card-foreground ring-foreground/10 dark:bg-card rounded-xl p-4 ring-1 shadow-xs"
    >
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        {label}
      </p>
      <p className="text-foreground mt-2 text-sm font-medium">{primary}</p>
      <p className="text-muted-foreground mt-0.5 text-xs">{secondary}</p>
    </div>
  );
}
