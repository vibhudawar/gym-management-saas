import { formatCalendarDate } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RevenueReport } from "@/server/queries/reports/get-revenue-report";

type Props = {
  daily: RevenueReport["daily"];
};

export function RevenueTable({ daily }: Props) {
  return (
    <section
      data-slot="card"
      className="bg-gradient-to-t from-primary/5 to-card text-card-foreground ring-foreground/10 dark:bg-card overflow-hidden rounded-xl ring-1 shadow-xs"
    >
      <header className="px-5 pt-4 pb-2">
        <h2 className="text-foreground text-base font-semibold tracking-tight">
          Daily breakdown
        </h2>
        <p className="text-muted-foreground text-xs">Newest first</p>
      </header>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-5">Date</TableHead>
              <TableHead className="text-right">Payments</TableHead>
              <TableHead className="text-right">Refunds</TableHead>
              <TableHead className="text-right">Net</TableHead>
              <TableHead className="text-right pr-5">Tx count</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {daily.map((d) => (
              <TableRow key={d.date}>
                <TableCell className="px-5 text-sm">
                  {formatCalendarDate(d.date)}
                </TableCell>
                <TableCell className="text-foreground tabular-nums text-right text-sm">
                  {d.paymentsPaise > 0 ? formatMoney(d.paymentsPaise) : "—"}
                </TableCell>
                <TableCell
                  className={cn(
                    "tabular-nums text-right text-sm",
                    d.refundsPaise < 0 ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {d.refundsPaise < 0 ? `-${formatMoney(Math.abs(d.refundsPaise))}` : "—"}
                </TableCell>
                <TableCell className="text-foreground tabular-nums text-right text-sm font-medium">
                  {formatMoney(d.netPaise)}
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums pr-5 text-right text-sm">
                  {d.transactionCount}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
