import { PiggyBank } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { formatMoney, formatMoneyShort } from "@/lib/utils/money";
import { inferPreset } from "@/lib/utils/date-presets";
import { exportDiscountDetails } from "@/server/actions/reports/export-discount-details";
import type { DiscountLeakageReport } from "@/server/queries/reports/get-discount-leakage-report";
import { ComparisonLine } from "./comparison-line";
import { DiscountByStaffTable } from "./discount-by-staff-table";
import { DiscountDetailsTable } from "./discount-details-table";
import { DiscountDistribution } from "./discount-distribution";
import { DiscountExportTrigger } from "./discount-export-trigger";
import { SummaryCard } from "./summary-card";

const DETAIL_CAP = 500;

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

type Props = {
  report: DiscountLeakageReport;
  filenameStem: string;
};

export function DiscountTab({ report, filenameStem }: Props) {
  const { summary, priorSummary, byStaff, details, range, distribution } =
    report;
  const empty = summary.discountedMembershipCount === 0;
  const pctOfGross =
    summary.totalGrossPaise > 0
      ? (summary.totalDiscountPaise / summary.totalGrossPaise) * 100
      : 0;
  const priorPctOfGross =
    priorSummary && priorSummary.totalGrossPaise > 0
      ? (priorSummary.totalDiscountPaise / priorSummary.totalGrossPaise) * 100
      : null;
  const capped = details.length >= DETAIL_CAP;
  const priorLabel = PRIOR_LABEL[inferPreset(range)];

  // Inline server-action call wrapper — we close over `range` so the
  // exporter knows which window to refetch uncapped data for.
  async function fetchAllDetails() {
    "use server";
    return exportDiscountDetails(range);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <DiscountExportTrigger
          filenameStem={filenameStem}
          fetchAll={fetchAllDetails}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          label="Total discount given"
          value={formatMoneyShort(summary.totalDiscountPaise)}
          subline={`across ${summary.discountedMembershipCount} ${summary.discountedMembershipCount === 1 ? "membership" : "memberships"}`}
          tone={summary.totalDiscountPaise > 0 ? "destructive" : "default"}
          comparison={
            <ComparisonLine
              current={summary.totalDiscountPaise}
              prior={priorSummary?.totalDiscountPaise ?? null}
              metric="discount"
              priorLabel={priorLabel}
            />
          }
        />
        <SummaryCard
          label="% of gross"
          value={`${pctOfGross.toFixed(1)}%`}
          subline="of gross revenue"
          comparison={
            priorPctOfGross !== null ? (
              <p className="text-muted-foreground text-xs">
                vs {priorPctOfGross.toFixed(1)}% {priorLabel.replace(/^vs\s/, "")}
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                No data for prior period
              </p>
            )
          }
        />
        <SummaryCard
          label="Avg discount"
          value={formatMoney(summary.avgDiscountPaise)}
          subline="per discounted enrolment"
          comparison={
            <ComparisonLine
              current={summary.avgDiscountPaise}
              prior={priorSummary?.avgDiscountPaise ?? null}
              metric="discount"
              asMoney
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
            icon={PiggyBank}
            title="No discounts given in this period."
            description="Either every enrolment paid full price, or there were no enrolments."
          />
        </div>
      ) : (
        <>
          <DiscountDistribution rows={distribution} />
          <DiscountByStaffTable rows={byStaff} />
          <DiscountDetailsTable rows={details} capped={capped} />
        </>
      )}
    </div>
  );
}
