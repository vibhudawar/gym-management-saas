"use client";

import type { PlanWiseReport } from "@/server/queries/reports/get-plan-wise-report";
import { ReportExportButton } from "./export-button";

type Props = {
  rows: PlanWiseReport["rows"];
  filenameStem: string;
};

export function PlanWiseExportTrigger({ rows, filenameStem }: Props) {
  return (
    <ReportExportButton
      filename={filenameStem}
      sheetName="Plans"
      buildRows={async () => ({
        rows: rows.map((r) => ({
          Plan: r.planName,
          Active: r.isActive ? "Yes" : "No",
          Sold: r.sold,
          "Gross revenue (₹)": r.grossRevenuePaise / 100,
          "Avg ticket (₹)": r.avgTicketPaise / 100,
          "Discount (₹)": r.discountPaise / 100,
          "Net (₹)": r.netPaise / 100,
        })),
        columnFormats: {
          Sold: { fmt: "0" },
          "Gross revenue (₹)": { fmt: "#,##0.00" },
          "Avg ticket (₹)": { fmt: "#,##0.00" },
          "Discount (₹)": { fmt: "#,##0.00" },
          "Net (₹)": { fmt: "#,##0.00" },
        },
      })}
    />
  );
}
