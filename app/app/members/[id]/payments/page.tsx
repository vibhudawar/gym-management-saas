import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isOwner } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/get-session";
import { formatCalendarDate } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils";
import { getMember } from "@/server/queries/members/get-member";
import { getPaymentsByMember } from "@/server/queries/payments/get-payments-by-member";
import { PAYMENT_MODE_LABELS } from "@/lib/constants/labels";

export const metadata: Metadata = { title: "Payments" };

export default async function MemberPaymentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireUser();
  const member = await getMember(id);
  if (!member) notFound();

  const payments = await getPaymentsByMember(member.id);
  const owner = isOwner(session.user.role);

  const net = payments.reduce((sum, p) => sum + p.amountPaise, 0);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="space-y-2 pb-4">
        <Link
          href={`/members/${member.id}`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          <ArrowLeft className="size-3.5" />
          Back to {member.name}
        </Link>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Payments · {member.name}
        </h1>
        <p className="text-muted-foreground text-sm">
          {payments.length} entries · Net {formatMoney(net)}
        </p>
      </div>

      <div className="bg-card overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              {owner ? <TableHead>Received by</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => {
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
                  <TableCell className="text-muted-foreground">
                    {formatCalendarDate(p.paymentDate)}
                  </TableCell>
                  <TableCell>{PAYMENT_MODE_LABELS[p.paymentMode]}</TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums font-medium",
                      isRefund && "text-destructive",
                    )}
                  >
                    {formatMoney(p.amountPaise)}
                  </TableCell>
                  {owner ? (
                    <TableCell className="text-muted-foreground text-xs">
                      {p.receivedByName ?? "—"}
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {payments.length === 0 ? (
          <p className="text-muted-foreground p-6 text-center text-sm">
            No payments yet.
          </p>
        ) : null}
      </div>
    </div>
  );
}
