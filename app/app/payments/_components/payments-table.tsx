"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PaymentRow } from "@/server/queries/payments/list-payments";
import { PAYMENT_MODE_LABELS } from "@/lib/constants/labels";
import { formatCalendarDate } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils";

type Props = {
  rows: PaymentRow[];
  showBranch: boolean;
  showReceivedBy: boolean;
};

export function PaymentsTable({ rows, showBranch, showReceivedBy }: Props) {
  return (
    <div className="bg-card overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Member</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Mode</TableHead>
            {showBranch ? <TableHead>Branch</TableHead> : null}
            {showReceivedBy ? <TableHead>Received by</TableHead> : null}
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p) => {
            const isRefund = p.kind === "refund";
            return (
              <TableRow key={p.id}>
                <TableCell>
                  <span className="text-foreground font-medium">
                    {p.invoiceNumber}
                  </span>
                  {isRefund ? (
                    <Badge
                      variant="outline"
                      className="ml-2 text-[10px] uppercase tracking-wide"
                    >
                      Refund
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatCalendarDate(p.paymentDate)}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/members/${p.memberId}`}
                    className="text-foreground hover:text-primary text-sm font-medium hover:underline"
                  >
                    {p.memberName}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {p.planName}
                </TableCell>
                <TableCell className="text-sm">
                  {PAYMENT_MODE_LABELS[p.paymentMode]}
                </TableCell>
                {showBranch ? (
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {p.branchName}
                    </Badge>
                  </TableCell>
                ) : null}
                {showReceivedBy ? (
                  <TableCell className="text-muted-foreground text-xs">
                    {p.receivedByName ?? "—"}
                  </TableCell>
                ) : null}
                <TableCell
                  className={cn(
                    "text-right tabular-nums font-medium",
                    isRefund && "text-destructive",
                  )}
                >
                  {formatMoney(p.amountPaise)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {rows.length === 0 ? (
        <p className="text-muted-foreground p-6 text-center text-sm">
          No payments match the current filters.
        </p>
      ) : null}
    </div>
  );
}
