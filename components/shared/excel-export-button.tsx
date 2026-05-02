"use client";

import { Download, Loader2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type ExportRow = Record<string, string | number | null | undefined>;

type ExcelExportButtonProps = {
  filename: string;
  fetchRows: () => Promise<ExportRow[]>;
  sheetName?: string;
  label?: string;
  className?: string;
};

export function ExcelExportButton({
  filename,
  fetchRows,
  sheetName = "Members",
  label = "Export",
  className,
}: ExcelExportButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleExport() {
    startTransition(async () => {
      try {
        const rows = await fetchRows();
        if (rows.length === 0) {
          toast.info("Nothing to export — current filter has no rows.");
          return;
        }
        if (rows.length > 10000) {
          toast.info(
            `Generating file for ${rows.length.toLocaleString("en-IN")} rows…`,
          );
        }
        const xlsx = await import("xlsx");
        const ws = xlsx.utils.json_to_sheet(rows);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, sheetName);
        xlsx.writeFile(wb, filename);
        toast.success(`Exported ${rows.length} rows`);
      } catch (err) {
        console.error("export failed", err);
        toast.error("Could not generate the file.");
      }
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleExport}
      disabled={isPending}
      className={className}
    >
      {isPending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      {label}
    </Button>
  );
}
