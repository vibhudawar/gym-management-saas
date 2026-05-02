"use client";

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CircleDashed,
  Download,
  Loader2,
  Upload,
} from "lucide-react";
import Papa from "papaparse";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  IMPORT_COLUMNS,
  MAX_ROWS,
  validateImportRows,
  type ImportRow,
  type ImportStatus,
  type RawCsvRow,
  type ValidationSummary,
} from "@/lib/csv/members-import";
import { cn } from "@/lib/utils";
import { importMembers } from "@/server/actions/members/import-members";

type Branch = { id: string; name: string };

type ImportWizardProps = {
  branches: Branch[];
  defaultBranchId: string;
  existingPhones: string[];
};

type WizardStep = "upload" | "parsing" | "preview" | "importing" | "done";

const STATUS_LABEL: Record<ImportStatus, string> = {
  valid: "Valid",
  warning: "Warning",
  error: "Error",
  duplicate: "Duplicate",
};

const STATUS_DOT: Record<ImportStatus, string> = {
  valid: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-destructive",
  duplicate: "bg-blue-500",
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export function ImportWizard({
  branches,
  defaultBranchId,
  existingPhones,
}: ImportWizardProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState<WizardStep>("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [filter, setFilter] = useState<ImportStatus | "all">("all");
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    perRowErrors: Array<{ rowNumber: number; error: string }>;
  } | null>(null);
  const [parseProgress, setParseProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [importPayloadCount, setImportPayloadCount] = useState(0);
  const [isPending, startTransition] = useTransition();

  const visibleRows = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  async function handleFile(file: File) {
    if (file.size > MAX_FILE_BYTES) {
      toast.error("File is over the 5 MB limit.");
      return;
    }
    setFileName(file.name);

    // Read once to estimate total row count for the determinate progress bar.
    // Cheaper than parsing twice; PapaParse then runs over the same text and
    // delivers structured rows via its `step` callback.
    let text: string;
    try {
      text = await file.text();
    } catch (err) {
      console.error("File.text() failed", err);
      toast.error("Could not read this file.");
      return;
    }

    const newlineCount = (text.match(/\n/g) ?? []).length;
    const trailingNewline = text.endsWith("\n");
    const lineCount = newlineCount + (trailingNewline ? 0 : 1);
    const estimatedRows = Math.max(0, lineCount - 1); // minus header

    setStep("parsing");
    setParseProgress({ current: 0, total: estimatedRows });

    const collected: Record<string, string>[] = [];
    let parseHeaders: string[] = [];
    let parseErrored = false;

    Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      worker: false,
      step(result) {
        if (parseErrored) return;
        if (parseHeaders.length === 0 && result.meta.fields) {
          parseHeaders = result.meta.fields.map((h) => h.trim().toLowerCase());
        }
        collected.push(result.data as Record<string, string>);
        setParseProgress({
          current: collected.length,
          total: Math.max(estimatedRows, collected.length),
        });
      },
      complete() {
        if (parseErrored) return;

        if (collected.length === 0) {
          toast.error(
            "We couldn't read this CSV. Make sure the first row is the header.",
          );
          setStep("upload");
          setParseProgress(null);
          return;
        }

        const requiredHeaders = ["name", "phone"];
        const missing = requiredHeaders.filter(
          (h) => !parseHeaders.includes(h),
        );
        if (missing.length > 0) {
          toast.error(
            `Missing required columns: ${missing.join(", ")}. Download the template to see the format.`,
          );
          setStep("upload");
          setParseProgress(null);
          return;
        }

        if (collected.length > MAX_ROWS) {
          toast.error(`Too many rows. Limit is ${MAX_ROWS}.`);
          setStep("upload");
          setParseProgress(null);
          return;
        }

        const rawRows: RawCsvRow[] = collected.map((row) => {
          const out: RawCsvRow = {};
          for (const key of Object.keys(row)) {
            const norm = key.trim().toLowerCase().replace(/\s+/g, "_");
            if (IMPORT_COLUMNS.includes(norm as (typeof IMPORT_COLUMNS)[number])) {
              out[norm as (typeof IMPORT_COLUMNS)[number]] = row[key];
            }
          }
          return out;
        });

        const result = validateImportRows(rawRows, {
          branches,
          existingPhones: new Set(existingPhones),
          defaultBranchId,
        });

        setRows(result.rows);
        setSummary(result.summary);
        setFilter("all");
        setParseProgress(null);
        setStep("preview");
      },
      error(err: unknown) {
        parseErrored = true;
        console.error("PapaParse error", err);
        toast.error("Could not parse this CSV.");
        setStep("upload");
        setParseProgress(null);
      },
    });
  }

  function reset() {
    setStep("upload");
    setRows([]);
    setSummary(null);
    setFileName(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleConfirmImport() {
    const payload = rows
      .filter((r) => r.parsed && (r.status === "valid" || r.status === "warning"))
      .map((r) => ({ rowNumber: r.rowNumber, row: r.parsed! }));

    if (payload.length === 0) {
      toast.error("Nothing valid to import.");
      return;
    }

    setImportPayloadCount(payload.length);
    setStep("importing");
    startTransition(async () => {
      const result = await importMembers(payload);
      if (!result.ok) {
        toast.error(result.error);
        setStep("preview");
        return;
      }
      setImportResult({
        imported: result.imported,
        skipped: result.skipped,
        perRowErrors: result.perRowErrors,
      });
      setStep("done");
      toast.success(`${result.imported} members imported`);
    });
  }

  if (step === "done" && importResult) {
    return (
      <div className="mx-auto max-w-2xl space-y-5 py-8">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="size-6 text-emerald-500" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Import complete
          </h1>
        </div>
        <p className="text-muted-foreground text-sm">
          {importResult.imported.toLocaleString("en-IN")} members added.
          {importResult.skipped > 0
            ? ` ${importResult.skipped} skipped.`
            : ""}
        </p>
        {importResult.perRowErrors.length > 0 ? (
          <div className="bg-card rounded-xl border p-4">
            <p className="text-foreground mb-2 text-sm font-medium">
              Skipped rows
            </p>
            <ul className="text-muted-foreground space-y-1 text-xs">
              {importResult.perRowErrors.slice(0, 50).map((e) => (
                <li key={e.rowNumber}>
                  Row {e.rowNumber}: {e.error}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <Button onClick={() => router.push("/members")}>Go to members</Button>
          <Button variant="outline" onClick={reset}>
            Import another file
          </Button>
        </div>
      </div>
    );
  }

  if (step === "parsing" && parseProgress) {
    const percent =
      parseProgress.total > 0
        ? Math.min(100, Math.round((parseProgress.current / parseProgress.total) * 100))
        : 0;
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <Loader2 className="text-primary mx-auto size-10 animate-spin" />
        <p className="text-foreground mt-4 text-sm font-medium">
          Parsing {parseProgress.current.toLocaleString("en-IN")} /{" "}
          {parseProgress.total.toLocaleString("en-IN")} rows…
        </p>
        <div className="bg-muted mx-auto mt-4 h-2 w-full max-w-xs overflow-hidden rounded-full">
          <div
            className="bg-primary h-full transition-[width] duration-150 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-muted-foreground mt-2 text-xs">{percent}%</p>
      </div>
    );
  }

  if (step === "importing") {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <Loader2 className="text-primary mx-auto size-10 animate-spin" />
        <p className="text-foreground mt-4 text-sm font-medium">
          Inserting {importPayloadCount.toLocaleString("en-IN")} members…
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          Hold on. This runs in a single transaction — about 30 seconds for
          1,000 rows.
        </p>
        <div className="bg-muted mx-auto mt-4 h-2 w-full max-w-xs overflow-hidden rounded-full">
          <div className="bg-primary/70 h-full w-1/3 animate-pulse" />
        </div>
      </div>
    );
  }

  if (step === "preview" && summary) {
    const validToImport = summary.valid + summary.warnings;
    const skipped = summary.errors + summary.duplicates;
    return (
      <div className="space-y-4">
        <div className="bg-card rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-sm">
              <CountChip label="Valid" value={summary.valid} dot="bg-emerald-500" />
              <CountChip label="Warnings" value={summary.warnings} dot="bg-amber-500" />
              <CountChip label="Errors" value={summary.errors} dot="bg-destructive" />
              <CountChip label="Duplicates" value={summary.duplicates} dot="bg-blue-500" />
            </div>
            <p className="text-muted-foreground text-sm">
              <span className="text-foreground font-semibold">
                {validToImport.toLocaleString("en-IN")}
              </span>{" "}
              will be imported · {skipped.toLocaleString("en-IN")} skipped
            </p>
          </div>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="all">All ({rows.length})</TabsTrigger>
            <TabsTrigger value="valid">Valid ({summary.valid})</TabsTrigger>
            <TabsTrigger value="warning">Warnings ({summary.warnings})</TabsTrigger>
            <TabsTrigger value="error">Errors ({summary.errors})</TabsTrigger>
            <TabsTrigger value="duplicate">Duplicates ({summary.duplicates})</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="bg-card overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Row</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.slice(0, 200).map((r) => (
                <TableRow key={r.rowNumber}>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {r.rowNumber}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 text-xs",
                      )}
                    >
                      <span className={cn("size-1.5 rounded-full", STATUS_DOT[r.status])} />
                      {STATUS_LABEL[r.status]}
                    </span>
                  </TableCell>
                  <TableCell>{r.raw.name ?? ""}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.raw.phone ?? ""}
                  </TableCell>
                  <TableCell>
                    {r.raw.branch ?? (
                      <span className="text-muted-foreground">
                        {r.parsed
                          ? branches.find((b) => b.id === r.parsed?.branchId)?.name
                          : "—"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {r.messages.join(" · ") || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {visibleRows.length > 200 ? (
            <p className="border-t p-3 text-center text-xs text-muted-foreground">
              Showing first 200 rows · {visibleRows.length - 200} more not shown
            </p>
          ) : null}
        </div>

        <div className="bg-background sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <Button variant="outline" onClick={reset} disabled={isPending}>
            <ArrowLeft className="size-4" />
            Choose a different file
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={isPending || validToImport === 0}>
                Import {validToImport.toLocaleString("en-IN")} members
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Import {validToImport.toLocaleString("en-IN")} members?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will add new member records to your gym. You can&apos;t bulk
                  delete imported members — you&apos;ll need to delete individually.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmImport}>
                  Import
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1">
        <Link
          href="/members"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          <ArrowLeft className="size-3.5" />
          Back to members
        </Link>
      </div>
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Import members from CSV
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Upload a CSV exported from your old system. We&apos;ll preview the rows
          before anything is saved.
        </p>
      </div>

      <label
        htmlFor="csv-file"
        className="border-border hover:border-primary/40 hover:bg-muted/30 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-card/40 px-6 py-12 text-center transition-colors"
      >
        <Upload className="text-muted-foreground size-8" />
        <div className="space-y-1">
          <p className="text-foreground text-sm font-medium">
            Drag a CSV file here, or click to browse
          </p>
          <p className="text-muted-foreground text-xs">
            Up to 5 MB · 10,000 rows · UTF-8 encoded
          </p>
        </div>
        {fileName ? (
          <p className="text-muted-foreground text-xs">Selected: {fileName}</p>
        ) : null}
        <input
          id="csv-file"
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </label>

      <div className="bg-card flex items-start justify-between gap-3 rounded-xl border p-4 text-sm">
        <div className="space-y-1">
          <p className="text-foreground font-medium">Need a template?</p>
          <p className="text-muted-foreground text-xs">
            Same column order is expected. Branch must match an existing branch
            name.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a
            href="/templates/members-import-template.csv"
            download="members-import-template.csv"
          >
            <Download className="size-4" />
            Download template
          </a>
        </Button>
      </div>

      <div className="bg-amber-500/5 border-amber-500/30 flex items-start gap-2 rounded-xl border p-3 text-sm">
        <AlertCircle className="text-amber-600 mt-0.5 size-4 shrink-0" />
        <div>
          <p className="text-foreground font-medium">Tips</p>
          <ul className="text-muted-foreground mt-1 list-disc space-y-1 pl-4 text-xs">
            <li>Phone is required and must be a 10-digit Indian mobile.</li>
            <li>Dates accept YYYY-MM-DD or DD/MM/YYYY.</li>
            <li>
              Branch column is required when your gym has multiple branches.
            </li>
          </ul>
        </div>
      </div>

      {step === "upload" && rows.length === 0 ? (
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <CircleDashed className="size-3.5" />
          Waiting for a file…
        </div>
      ) : null}
    </div>
  );
}

function CountChip({
  label,
  value,
  dot,
}: {
  label: string;
  value: number;
  dot: string;
}) {
  return (
    <Badge variant="outline" className="gap-1.5 text-xs">
      <span className={cn("size-1.5 rounded-full", dot)} />
      <span className="font-medium">{value.toLocaleString("en-IN")}</span>
      <span className="text-muted-foreground">{label}</span>
    </Badge>
  );
}
