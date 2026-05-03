"use client";

import { ReportExportButton } from "./export-button";

type ExportRow = {
  Date: string;
  Member: string;
  Plan: string;
  "Discount (₹)": number;
  Reason: string;
  "Enrolled by": string;
};

type Props = {
  filenameStem: string;
  fetchAll: () => Promise<ExportRow[]>;
};

/**
 * Discount export goes through a server action to fetch the *uncapped* detail
 * list (the in-page table tops out at 500 rows). The fetcher handles that.
 */
export function DiscountExportTrigger({ filenameStem, fetchAll }: Props) {
  return (
    <ReportExportButton
      filename={filenameStem}
      sheetName="Discounts"
      buildRows={async () => {
        const rows = await fetchAll();
        return {
          rows,
          columnFormats: {
            "Discount (₹)": { fmt: "#,##0.00" },
          },
        };
      }}
    />
  );
}
