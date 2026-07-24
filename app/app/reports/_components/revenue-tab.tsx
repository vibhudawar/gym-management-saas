import { Receipt } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { formatMoney, formatMoneyShort } from "@/lib/utils/money";
import { inferPreset } from "@/lib/utils/date-presets";
import type { RevenueReport } from "@/server/queries/reports/get-revenue-report";
import { ComparisonLine } from "./comparison-line";
import { RevenueChart } from "./revenue-chart";
import { RevenueExportTrigger } from "./revenue-export-trigger";
import { RevenueTable } from "./revenue-table";
import { SummaryCard } from "./summary-card";

type Props = {
  report: RevenueReport;
  filenameStem: string;
};

const PRIOR_LABEL: Record<ReturnType<typeof inferPreset>, string> = {
  today: "vs yesterday",
  yesterday: "vs day before",
  last_7_days: "vs previous 7 days",
  this_week: "vs last week",
  last_week: "vs week before",
  this_month: "vs last month",
  last_month: "vs month before",
  this_quarter: "vs last quarter",
  last_quarter: "vs quarter before",
  this_year: "vs last year",
  custom: "vs prior period",
};

export function RevenueTab({ report, filenameStem }: Props) {
  const { summary, priorSummary, daily, range } = report;
  const avgPerDay =
    summary.daysInRange > 0 ? Math.round(summary.netPaise / summary.daysInRange) : 0;
  const priorAvgPerDay =
    priorSummary && priorSummary.daysInRange > 0
      ? Math.round(priorSummary.netPaise / priorSummary.daysInRange)
      : null;
  const empty = summary.transactionCount === 0 && summary.refundCount === 0;
  const priorLabel = PRIOR_LABEL[inferPreset(range)];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <RevenueExportTrigger
          rows={daily}
          filenameStem={filenameStem}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Total revenue"
          value={formatMoneyShort(summary.totalRevenuePaise)}
          subline={`${summary.transactionCount} ${summary.transactionCount === 1 ? "transaction" : "transactions"}`}
          comparison={
            <ComparisonLine
              current={summary.totalRevenuePaise}
              prior={priorSummary?.totalRevenuePaise ?? null}
              metric="revenue"
              priorLabel={priorLabel}
            />
          }
        />
        <SummaryCard
          label="Refunds"
          value={formatMoneyShort(summary.refundsPaise)}
          subline={`${summary.refundCount} ${summary.refundCount === 1 ? "refund" : "refunds"}`}
          tone={summary.refundsPaise > 0 ? "destructive" : "default"}
          comparison={
            <ComparisonLine
              current={summary.refundsPaise}
              prior={priorSummary?.refundsPaise ?? null}
              metric="refund"
              asMoney
              priorLabel={priorLabel}
            />
          }
        />
        <SummaryCard
          label="Net"
          value={formatMoney(summary.netPaise)}
          subline={null}
          tone="primary"
          comparison={
            <ComparisonLine
              current={summary.netPaise}
              prior={priorSummary?.netPaise ?? null}
              metric="revenue"
              priorLabel={priorLabel}
            />
          }
        />
        <SummaryCard
          label="Avg / day"
          value={formatMoneyShort(avgPerDay)}
          subline={`${summary.daysInRange} days`}
          comparison={
            <ComparisonLine
              current={avgPerDay}
              prior={priorAvgPerDay}
              metric="revenue"
              priorLabel={priorLabel}
            />
          }
        />
      </div>

      {empty ? (
        <div
          data-slot="card"
          className="bg-gradient-to-t from-primary/5 to-card ring-foreground/10 rounded-xl py-12 ring-1 shadow-xs"
        >
          <EmptyState
            icon={Receipt}
            title="No payments in this period."
            description="Try widening the date range."
          />
        </div>
      ) : (
        <>
          <RevenueChart range={range} daily={daily} />
          <RevenueTable daily={daily} />
        </>
      )}
    </div>
  );
}
