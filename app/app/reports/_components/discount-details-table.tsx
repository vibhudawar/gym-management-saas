import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCalendarDate } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";
import type { DiscountLeakageReport } from "@/server/queries/reports/get-discount-leakage-report";

type Props = {
  rows: DiscountLeakageReport["details"];
  capped: boolean;
};

const REASON_TRUNCATE = 60;

export function DiscountDetailsTable({ rows, capped }: Props) {
  if (rows.length === 0) return null;
  return (
    <section
      data-slot="card"
      className="bg-gradient-to-t from-primary/5 to-card text-card-foreground ring-foreground/10 dark:bg-card overflow-hidden rounded-xl ring-1 shadow-xs"
    >
      <header className="flex items-baseline justify-between gap-2 px-5 pt-4 pb-2">
        <div>
          <h2 className="text-foreground text-base font-semibold tracking-tight">
            All discounted memberships
          </h2>
          <p className="text-muted-foreground text-xs">
            {capped
              ? "Showing first 500 — export for the full list"
              : `${rows.length} ${rows.length === 1 ? "row" : "rows"}`}
          </p>
        </div>
      </header>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-5">Date</TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="text-right">Discount</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="pr-5">By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const truncatedReason =
                r.reason && r.reason.length > REASON_TRUNCATE
                  ? `${r.reason.slice(0, REASON_TRUNCATE)}…`
                  : r.reason;
              return (
                <TableRow key={r.membershipId}>
                  <TableCell className="px-5 text-sm">
                    {formatCalendarDate(r.createdDate)}
                  </TableCell>
                  <TableCell className="text-sm">
                    <Link
                      href={`/members/${r.memberId}`}
                      className="text-primary hover:underline"
                    >
                      {r.memberName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{r.planName}</TableCell>
                  <TableCell className="text-destructive tabular-nums text-right text-sm">
                    -{formatMoney(r.discountPaise)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {r.reason ? (
                      r.reason.length > REASON_TRUNCATE ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help underline-offset-2 hover:underline">
                              {truncatedReason}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            {r.reason}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        truncatedReason
                      )
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground pr-5 text-sm">
                    {r.enrolledByUserName ?? "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
