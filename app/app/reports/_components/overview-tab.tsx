import { formatInTimeZone } from "date-fns-tz";
import { formatMoney, formatMoneyShort } from "@/lib/utils/money";
import {
  formatRangeLabel,
  inferPreset,
  type DateRange,
} from "@/lib/utils/date-presets";
import type { OverviewReport } from "@/server/queries/reports/get-overview";
import { AnomalyCard } from "./anomaly-card";
import { DigDeeperLinks } from "./dig-deeper-links";
import { HighlightCard } from "./highlight-card";
import { OverviewHeadline } from "./overview-headline";
import { TrendChart } from "./trend-chart";

const MAX_ANOMALIES = 3;

type Props = {
  report: OverviewReport;
};

function priorLabel(range: DateRange): string {
  const preset = inferPreset(range);
  switch (preset) {
    case "today":
      return "vs yesterday";
    case "yesterday":
      return "vs day before";
    case "last_7_days":
      return "vs previous 7 days";
    case "this_week":
      return "vs last week";
    case "last_week":
      return "vs week before";
    case "this_month":
      return "vs last month";
    case "last_month":
      return "vs month before";
    case "this_quarter":
      return "vs last quarter";
    case "last_quarter":
      return "vs quarter before";
    case "this_year":
      return "vs last year";
    case "custom":
      return "vs prior period";
  }
}

function formatDateLabel(iso: string): string {
  return formatInTimeZone(new Date(`${iso}T00:00:00Z`), "UTC", "d MMM");
}

export function OverviewTab({ report }: Props) {
  const visibleAnomalies = report.anomalies.slice(0, MAX_ANOMALIES);
  const hiddenCount = Math.max(0, report.anomalies.length - MAX_ANOMALIES);
  const label = priorLabel(report.range);

  return (
    <div className="space-y-6">
      <OverviewHeadline
        netPaise={report.headline.netPaise}
        priorNetPaise={report.headline.priorNetPaise}
        deltaPct={report.headline.deltaPct}
        direction={report.headline.direction}
        newMembers={report.headline.newMembers}
        refundsPaise={report.headline.refundsPaise}
        priorLabel={label}
      />

      {visibleAnomalies.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Needs attention
          </h3>
          <div className="space-y-3">
            {visibleAnomalies.map((a) => (
              <AnomalyCard key={a.id} anomaly={a} />
            ))}
          </div>
          {hiddenCount > 0 ? (
            <p className="text-muted-foreground text-xs">
              + {hiddenCount} more in this period
            </p>
          ) : null}
        </section>
      ) : null}

      <TrendChart current={report.trend.current} prior={report.trend.prior} />

      <section className="space-y-3">
        <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          Highlights
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <HighlightCard
            label="Best day"
            primary={
              report.highlights.bestDay
                ? `${formatDateLabel(report.highlights.bestDay.date)} · ${formatMoneyShort(
                    report.highlights.bestDay.netPaise,
                  )}`
                : "Not enough data yet"
            }
            secondary={
              report.highlights.bestDay
                ? `${report.highlights.bestDay.enrolments} ${report.highlights.bestDay.enrolments === 1 ? "enrolment" : "enrolments"}`
                : ""
            }
          />
          <HighlightCard
            label="Top plan"
            primary={
              report.highlights.topPlan
                ? report.highlights.topPlan.planName
                : "Not enough data yet"
            }
            secondary={
              report.highlights.topPlan
                ? `${formatMoney(report.highlights.topPlan.netPaise)} across ${report.highlights.topPlan.sold} ${report.highlights.topPlan.sold === 1 ? "sale" : "sales"}`
                : ""
            }
          />
          <HighlightCard
            label="Most active day"
            primary={
              report.highlights.mostActiveDayOfWeek
                ? `${report.highlights.mostActiveDayOfWeek.dayName}s`
                : "Not enough data yet"
            }
            secondary={
              report.highlights.mostActiveDayOfWeek
                ? `Avg ${report.highlights.mostActiveDayOfWeek.avgEnrolments} ${
                    report.highlights.mostActiveDayOfWeek.avgEnrolments === 1
                      ? "enrolment"
                      : "enrolments"
                  }`
                : ""
            }
          />
          <HighlightCard
            label="Slowest week"
            primary={
              report.highlights.slowestWeek
                ? formatRangeLabel({
                    from: report.highlights.slowestWeek.weekStart,
                    to: report.highlights.slowestWeek.weekEnd,
                  })
                : "Not enough data yet"
            }
            secondary={
              report.highlights.slowestWeek
                ? `${formatMoneyShort(report.highlights.slowestWeek.netPaise)} (avg ${formatMoneyShort(report.highlights.slowestWeek.avgWeekPaise)})`
                : ""
            }
          />
        </div>
      </section>

      <DigDeeperLinks range={report.range} />
    </div>
  );
}
