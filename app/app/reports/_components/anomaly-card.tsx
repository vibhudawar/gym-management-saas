import { ArrowRight, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Anomaly } from "@/lib/utils/anomaly-rules/types";

type Props = {
  anomaly: Anomaly;
};

const SEVERITY_CLASSES: Record<Anomaly["severity"], { bar: string; icon: string }> =
  {
    medium: { bar: "bg-amber-500", icon: "text-amber-600" },
    high: { bar: "bg-destructive", icon: "text-destructive" },
  };

export function AnomalyCard({ anomaly }: Props) {
  const styles = SEVERITY_CLASSES[anomaly.severity];
  return (
    <section
      data-slot="card"
      className="bg-gradient-to-t from-primary/5 to-card text-card-foreground ring-foreground/10 dark:bg-card relative overflow-hidden rounded-xl p-4 ring-1 shadow-xs"
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", styles.bar)} />
      <div className="flex items-start gap-3 pl-2">
        <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", styles.icon)} />
        <div className="min-w-0 flex-1">
          <p className="text-foreground text-sm font-medium">{anomaly.headline}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">{anomaly.subline}</p>
          <Link
            href={anomaly.actionHref}
            className="text-primary mt-2 inline-flex items-center gap-1 text-xs hover:underline"
          >
            {anomaly.actionLabel}
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>
    </section>
  );
}
