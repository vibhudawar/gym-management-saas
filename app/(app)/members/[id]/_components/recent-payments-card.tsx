"use client";

import { History, MoreHorizontal, Pencil, Undo2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MemberPaymentRow } from "@/server/queries/payments/get-payments-by-member";
import type { PaymentMode } from "@/lib/db/schema/payments";
import { formatCalendarDate } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils";
import { EditPaymentSheet } from "./edit-payment-sheet";
import { RefundSheet } from "./refund-sheet";

const MODE_LABEL: Record<PaymentMode, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  bank_transfer: "Bank",
};

type Props = {
  memberId: string;
  payments: MemberPaymentRow[];
  canManagePayments: boolean;
};

export function RecentPaymentsCard({
  memberId,
  payments,
  canManagePayments,
}: Props) {
  const [refundFor, setRefundFor] = useState<MemberPaymentRow | null>(null);
  const [editFor, setEditFor] = useState<MemberPaymentRow | null>(null);

  return (
    <section className="bg-card rounded-xl border p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-foreground text-sm font-semibold tracking-tight">
          Recent payments
        </h2>
        {payments.length > 0 ? (
          <Link
            href={`/members/${memberId}/payments`}
            className="text-primary text-xs hover:underline"
          >
            View all →
          </Link>
        ) : null}
      </div>
      {payments.length === 0 ? (
        <p className="text-muted-foreground text-sm">No payments yet.</p>
      ) : (
        <>
        <ul className="divide-border divide-y">
          {payments.map((p) => {
            const isRefund = p.kind === "refund";
            return (
              <li key={p.id} className="flex items-start justify-between gap-3 py-3 text-sm first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="text-foreground flex items-center gap-1.5 font-medium">
                    <span>{p.invoiceNumber}</span>
                    {isRefund ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] uppercase tracking-wide"
                      >
                        Refund
                      </Badge>
                    ) : null}
                    {p.correctedAt ? (
                      <Badge
                        variant="outline"
                        className="border-amber-500/40 bg-amber-500/5 gap-1 text-[10px] tracking-wide text-amber-700"
                      >
                        <History className="size-3" />
                        Corrected
                      </Badge>
                    ) : null}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatCalendarDate(p.paymentDate)} · {MODE_LABEL[p.paymentMode]}
                    {p.receivedByName ? ` · by ${p.receivedByName}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "tabular-nums text-sm font-medium",
                      isRefund ? "text-destructive" : "text-foreground",
                    )}
                  >
                    {formatMoney(p.amountPaise)}
                  </span>
                  {canManagePayments && !isRefund ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Payment actions"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-auto min-w-fit">
                        <DropdownMenuItem onClick={() => setRefundFor(p)}>
                          <Undo2 className="size-4" />
                          Record refund
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditFor(p)}>
                          <Pencil className="size-4" />
                          Edit payment
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        <PaymentTotals payments={payments} />
        </>
      )}

      <RefundSheet
        open={refundFor !== null}
        onOpenChange={(o) => !o && setRefundFor(null)}
        payment={refundFor}
      />
      <EditPaymentSheet
        open={editFor !== null}
        onOpenChange={(o) => !o && setEditFor(null)}
        payment={editFor}
      />
    </section>
  );
}

function PaymentTotals({ payments }: { payments: MemberPaymentRow[] }) {
  const totalPaid = payments
    .filter((p) => p.kind === "payment")
    .reduce((sum, p) => sum + p.amountPaise, 0);
  const refunded = payments
    .filter((p) => p.kind === "refund")
    .reduce((sum, p) => sum + p.amountPaise, 0); // already negative
  const net = totalPaid + refunded;

  return (
    <div className="text-muted-foreground border-border mt-3 border-t pt-3 text-xs">
      Total paid:{" "}
      <span className="text-foreground font-medium">{formatMoney(totalPaid)}</span>
      {refunded < 0 ? (
        <>
          {" · Net (after refunds): "}
          <span className="text-foreground font-medium">{formatMoney(net)}</span>
        </>
      ) : null}
    </div>
  );
}
