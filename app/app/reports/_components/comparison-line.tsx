import { ArrowDown, ArrowUp } from "lucide-react";
import {
  deltaPercent,
  tonefor,
  type DeltaTone,
} from "@/lib/utils/period-comparison";
import { formatMoneyShort } from "@/lib/utils/money";
import { cn } from "@/lib/utils";

type Props = {
  current: number;
  prior: number | null;
  /**
   * Drives the directional color treatment:
   * - revenue/enrolments — green when up, red when down.
   * - refund/discount — neutral always (no editorialization).
   */
  metric: "revenue" | "enrolments" | "refund" | "discount" | "neutral";
  /** Show absolute delta in money instead of % (used for refunds where 0→1 = ∞%). */
  asMoney?: boolean;
  priorLabel?: string; // e.g., "vs last month"
};

const TONE_CLASS: Record<DeltaTone, string> = {
  good: "text-emerald-700",
  bad: "text-destructive",
  neutral: "text-muted-foreground",
};

export function ComparisonLine({
  current,
  prior,
  metric,
  asMoney = false,
  priorLabel = "vs last period",
}: Props) {
  if (prior === null) {
    return (
      <p className="text-muted-foreground text-xs">
        No data for prior period
      </p>
    );
  }

  const { pct, absChange, direction } = deltaPercent(current, prior);
  const tone = tonefor(metric, direction);

  if (direction === "flat") {
    return (
      <p className="text-muted-foreground inline-flex items-center gap-1 text-xs">
        Same as previous
      </p>
    );
  }

  const sign = direction === "up" ? "↑" : "↓";
  const Icon = direction === "up" ? ArrowUp : ArrowDown;
  const valueText = asMoney
    ? `${sign} ${formatMoneyShort(Math.abs(absChange))}`
    : pct === null
      ? `${sign} from ${formatMoneyShort(prior)}`
      : `${sign} ${Math.abs(pct)}%`;

  return (
    <p className={cn("inline-flex items-center gap-1 text-xs", TONE_CLASS[tone])}>
      <Icon className="size-3" />
      <span className="font-medium">{valueText}</span>
      <span className="text-muted-foreground">{priorLabel}</span>
    </p>
  );
}
