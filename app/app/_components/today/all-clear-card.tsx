import { CheckCircle2 } from "lucide-react";

/**
 * Single full-width tile shown when BOTH "Expiring soon" and "Recently expired"
 * lists are empty. Replaces the two compact empty-state cards with one band so
 * the page stops feeling hollow.
 */
export function AllClearCard() {
  return (
    <section
      data-slot="card"
      className="bg-gradient-to-t from-primary/5 to-card text-card-foreground ring-foreground/10 dark:bg-card flex items-center gap-3 rounded-xl px-6 py-5 ring-1 shadow-xs"
    >
      <CheckCircle2 className="text-emerald-600 size-5 shrink-0" />
      <div>
        <p className="text-foreground text-sm font-medium">
          All members are up to date.
        </p>
        <p className="text-muted-foreground text-xs">
          Nothing expiring in the next 14 days, no recent expirations.
        </p>
      </div>
    </section>
  );
}
