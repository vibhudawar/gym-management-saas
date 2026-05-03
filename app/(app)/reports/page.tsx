import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { requireRole } from "@/lib/auth/get-session";
import {
  isValidDateRange,
  resolvePreset,
  type DateRange,
} from "@/lib/utils/date-presets";
import { getDiscountLeakageReport } from "@/server/queries/reports/get-discount-leakage-report";
import { getOverviewReport } from "@/server/queries/reports/get-overview";
import { getPlanWiseReport } from "@/server/queries/reports/get-plan-wise-report";
import { getRevenueReport } from "@/server/queries/reports/get-revenue-report";
import { DiscountTab } from "./_components/discount-tab";
import { OverviewTab } from "./_components/overview-tab";
import { PlanWiseTab } from "./_components/plan-wise-tab";
import { ReportFilters, type ReportTab } from "./_components/report-filters";
import { RevenueTab } from "./_components/revenue-tab";

export const metadata: Metadata = { title: "Reports" };

type SearchParams = Record<string, string | string[] | undefined>;

function asString(value: SearchParams[string]): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

const VALID_TABS: ReadonlyArray<ReportTab> = [
  "overview",
  "revenue",
  "plans",
  "discounts",
];

function resolveRange(params: SearchParams): DateRange {
  const from = asString(params.from);
  const to = asString(params.to);
  if (from && to && isValidDateRange({ from, to })) {
    return { from, to };
  }
  return resolvePreset("this_month");
}

function sanitizeForFilename(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const session = await requireRole("owner", "branch_manager");

  const tabRaw = asString(params.tab);
  const tab: ReportTab = VALID_TABS.includes(tabRaw as ReportTab)
    ? (tabRaw as ReportTab)
    : "overview";

  const range = resolveRange(params);
  const branchPart = session.activeBranch
    ? sanitizeForFilename(session.activeBranch.name)
    : "all-branches";
  const gymPart = sanitizeForFilename(session.gym.name);
  const filenameStem = `${tab}-${gymPart}-${branchPart}-${range.from}-to-${range.to}`;

  const branchLabel = session.activeBranch?.name ?? "All branches";

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="Reports"
        description={`${branchLabel} · ${session.gym.name}`}
      />
      <ReportFilters range={range} activeTab={tab} />
      <div className="mt-6">
        {tab === "overview" ? (
          <OverviewTab report={await getOverviewReport(range)} />
        ) : null}
        {tab === "revenue" ? (
          <RevenueTab
            report={await getRevenueReport(range)}
            filenameStem={filenameStem}
          />
        ) : null}
        {tab === "plans" ? (
          <PlanWiseTab
            report={await getPlanWiseReport(range)}
            filenameStem={filenameStem}
          />
        ) : null}
        {tab === "discounts" ? (
          <DiscountTab
            report={await getDiscountLeakageReport(range)}
            filenameStem={filenameStem}
          />
        ) : null}
      </div>
    </div>
  );
}
