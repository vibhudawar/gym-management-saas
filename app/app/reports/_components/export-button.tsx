"use client";

import { Download, Loader2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type ExportRow = Record<string, string | number | null | undefined>;

type ColumnFormat = {
  /** Cell format string (SheetJS): e.g. `'0'` for integer, `'#,##0.00'` for money. */
  fmt?: string;
};

type Props = {
  filename: string; // without extension
  sheetName: string;
  /**
   * Closure that returns the rows + per-column format hints. Run on click so
   * we don't pay the SheetJS import / serialization cost on every render.
   */
  buildRows: () => Promise<{
    rows: ExportRow[];
    columnFormats?: Record<string, ColumnFormat>;
  }>;
  label?: string;
  disabled?: boolean;
};

export function ReportExportButton({
  filename,
  sheetName,
  buildRows,
  label = "Export",
  disabled = false,
}: Props) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        const built = await buildRows();
        if (built.rows.length === 0) {
          toast.info("Nothing to export — current filter has no rows.");
          return;
        }
        if (built.rows.length > 5_000) {
          toast.info(
            `Generating file for ${built.rows.length.toLocaleString("en-IN")} rows…`,
          );
        }
        const xlsx = await import("xlsx");
        const ws = xlsx.utils.json_to_sheet(built.rows);

        if (built.columnFormats) {
          const headers = Object.keys(built.rows[0] ?? {});
          for (const [col, fmt] of Object.entries(built.columnFormats)) {
            if (!fmt.fmt) continue;
            const colIdx = headers.indexOf(col);
            if (colIdx < 0) continue;
            for (let r = 1; r <= built.rows.length; r++) {
              const ref = xlsx.utils.encode_cell({ c: colIdx, r });
              const cell = (ws as Record<string, unknown>)[ref];
              if (cell && typeof cell === "object") {
                (cell as { z?: string }).z = fmt.fmt;
              }
            }
          }
        }

        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, sheetName);
        xlsx.writeFile(wb, `${filename}.xlsx`);
        toast.success(`Exported ${built.rows.length} rows`);
      } catch (err) {
        console.error("export failed", err);
        toast.error("Could not generate the file.");
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isPending || disabled}
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Download className="size-4" />
      )}
      {label}
    </Button>
  );
}
