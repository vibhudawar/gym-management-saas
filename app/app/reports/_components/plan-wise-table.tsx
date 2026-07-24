import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils";
import type { PlanWiseReport } from "@/server/queries/reports/get-plan-wise-report";
import { PlanSparkline } from "./plan-sparkline";

type Props = {
  rows: PlanWiseReport["rows"];
  totals: PlanWiseReport["totals"];
  showSparkline: boolean;
};

export function PlanWiseTable({ rows, totals, showSparkline }: Props) {
  const colSpanForTotal = showSparkline ? 7 : 6;
  void colSpanForTotal;
  return (
    <section
      data-slot="card"
      className="bg-gradient-to-t from-primary/5 to-card text-card-foreground ring-foreground/10 dark:bg-card overflow-hidden rounded-xl ring-1 shadow-xs"
    >
      <header className="px-5 pt-4 pb-2">
        <h2 className="text-foreground text-base font-semibold tracking-tight">
          Plan details
        </h2>
      </header>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-5">Plan</TableHead>
              {showSparkline ? (
                <TableHead className="w-24">Trend</TableHead>
              ) : null}
              <TableHead className="text-right">Sold</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Avg ticket</TableHead>
              <TableHead className="text-right">Discount</TableHead>
              <TableHead className="pr-5 text-right">Net</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.planId}>
                <TableCell
                  className={cn(
                    "px-5 text-sm",
                    !r.isActive && "text-muted-foreground line-through",
                  )}
                >
                  {r.planName}
                  {!r.isActive ? (
                    <span className="text-muted-foreground/70 ml-2 text-xs no-underline">
                      (inactive)
                    </span>
                  ) : null}
                </TableCell>
                {showSparkline ? (
                  <TableCell className="w-24">
                    <PlanSparkline weeklyCounts={r.weeklyCounts} />
                  </TableCell>
                ) : null}
                <TableCell className="text-foreground tabular-nums text-right text-sm">
                  {r.sold}
                </TableCell>
                <TableCell className="text-foreground tabular-nums text-right text-sm">
                  {formatMoney(r.grossRevenuePaise)}
                </TableCell>
                <TableCell className="text-foreground tabular-nums text-right text-sm">
                  {r.avgTicketPaise > 0 ? formatMoney(r.avgTicketPaise) : "—"}
                </TableCell>
                <TableCell
                  className={cn(
                    "tabular-nums text-right text-sm",
                    r.discountPaise > 0
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {r.discountPaise > 0 ? `-${formatMoney(r.discountPaise)}` : "—"}
                </TableCell>
                <TableCell className="text-foreground tabular-nums pr-5 text-right text-sm font-medium">
                  {formatMoney(r.netPaise)}
                </TableCell>
              </TableRow>
            ))}
            {rows.length > 0 ? (
              <TableRow className="bg-muted/30 font-medium">
                <TableCell className="px-5 text-sm">Total</TableCell>
                {showSparkline ? (
                  <TableCell className="text-muted-foreground text-xs">—</TableCell>
                ) : null}
                <TableCell className="tabular-nums text-right text-sm">
                  {totals.sold}
                </TableCell>
                <TableCell className="tabular-nums text-right text-sm">
                  {formatMoney(totals.grossRevenuePaise)}
                </TableCell>
                <TableCell className="text-muted-foreground text-right text-sm">
                  —
                </TableCell>
                <TableCell
                  className={cn(
                    "tabular-nums text-right text-sm",
                    totals.discountPaise > 0
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {totals.discountPaise > 0
                    ? `-${formatMoney(totals.discountPaise)}`
                    : "—"}
                </TableCell>
                <TableCell className="tabular-nums pr-5 text-right text-sm">
                  {formatMoney(totals.netPaise)}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
