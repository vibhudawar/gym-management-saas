"use client";

import type { RevenueReport } from "@/server/queries/reports/get-revenue-report";
import { ReportExportButton } from "./export-button";

type Props = {
  rows: RevenueReport["daily"];
  filenameStem: string; // e.g. "revenue-zenith-fitness-2026-04-01-to-2026-04-30"
};

/**
 * Wraps the generic export button with the revenue tab's specific column
 * mapping. SheetJS receives raw rupee numbers (not formatted strings) so
 * the CA can SUM/AVG inside Excel.
 */
export function RevenueExportTrigger({ rows, filenameStem }: Props) {
  return (
    <ReportExportButton
      filename={filenameStem}
      sheetName="Revenue"
      buildRows={async () => {
        const out = rows.map((d) => ({
          Date: d.date,
          "Payments (₹)": d.paymentsPaise / 100,
          "Refunds (₹)": d.refundsPaise / 100,
          "Net (₹)": d.netPaise / 100,
          Transactions: d.transactionCount,
        }));
        return {
          rows: out,
          columnFormats: {
            "Payments (₹)": { fmt: "#,##0.00" },
            "Refunds (₹)": { fmt: "#,##0.00" },
            "Net (₹)": { fmt: "#,##0.00" },
            Transactions: { fmt: "0" },
          },
        };
      }}
    />
  );
}
