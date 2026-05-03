import { ListChecks } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import type { PlanWiseReport } from "@/server/queries/reports/get-plan-wise-report";
import { PlanWiseChart } from "./plan-wise-chart";
import { PlanWiseExportTrigger } from "./plan-wise-export-trigger";
import { PlanWiseTable } from "./plan-wise-table";

type Props = {
  report: PlanWiseReport;
  filenameStem: string;
};

export function PlanWiseTab({ report, filenameStem }: Props) {
  const { rows, totals } = report;
  const empty = rows.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <PlanWiseExportTrigger rows={rows} filenameStem={filenameStem} />
      </div>

      {empty ? (
        <div
          data-slot="card"
          className="bg-gradient-to-t from-primary/5 to-card ring-foreground/10 rounded-xl py-12 ring-1 shadow-xs"
        >
          <EmptyState
            icon={ListChecks}
            title="No memberships sold in this period."
            description="Try widening the date range or pick a different branch."
          />
        </div>
      ) : (
        <>
          <PlanWiseChart rows={rows} />
          <PlanWiseTable
            rows={rows}
            totals={totals}
            showSparkline={report.weekBuckets > 0}
          />
        </>
      )}
    </div>
  );
}
