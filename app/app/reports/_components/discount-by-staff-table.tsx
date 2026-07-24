import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/utils/money";
import type { DiscountLeakageReport } from "@/server/queries/reports/get-discount-leakage-report";

type Props = {
  rows: DiscountLeakageReport["byStaff"];
};

export function DiscountByStaffTable({ rows }: Props) {
  if (rows.length === 0) return null;
  return (
    <section
      data-slot="card"
      className="bg-gradient-to-t from-primary/5 to-card text-card-foreground ring-foreground/10 dark:bg-card overflow-hidden rounded-xl ring-1 shadow-xs"
    >
      <header className="px-5 pt-4 pb-2">
        <h2 className="text-foreground text-base font-semibold tracking-tight">
          By staff member
        </h2>
        <p className="text-muted-foreground text-xs">
          Sorted by total discount given
        </p>
      </header>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-5">Staff</TableHead>
              <TableHead className="text-right">Discounted</TableHead>
              <TableHead className="text-right">Total given</TableHead>
              <TableHead className="text-right">Avg</TableHead>
              <TableHead className="pr-5 text-right">% of own revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.userId}>
                <TableCell className="px-5 text-sm">{r.userName}</TableCell>
                <TableCell className="tabular-nums text-right text-sm">
                  {r.discountedCount}
                </TableCell>
                <TableCell className="text-destructive tabular-nums text-right text-sm">
                  -{formatMoney(r.totalDiscountPaise)}
                </TableCell>
                <TableCell className="text-foreground tabular-nums text-right text-sm">
                  {formatMoney(r.avgDiscountPaise)}
                </TableCell>
                <TableCell className="text-foreground tabular-nums pr-5 text-right text-sm">
                  {(r.percentOfOwnRevenue * 100).toFixed(1)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
