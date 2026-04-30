"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/shared/money-input";
import { PaymentModeSelector } from "@/components/shared/payment-mode-selector";
import type { MemberPaymentRow } from "@/server/queries/payments/get-payments-by-member";
import type { PaymentMode } from "@/lib/db/schema/payments";
import { formatCalendarDate } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";
import { recordRefund } from "@/server/actions/payments/record-refund";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: MemberPaymentRow | null;
};

const MIN_REASON = 10;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RefundSheet({ open, onOpenChange, payment }: Props) {
  const [amountPaise, setAmountPaise] = useState<number>(0);
  const [mode, setMode] = useState<PaymentMode>("cash");
  const [refundDate, setRefundDate] = useState<string>(todayIso());
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !payment) return;
    // Sheet just opened with a payment — seed editable state from it. Documented
    // React pattern for "adjust state when a prop changes".
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAmountPaise(payment.amountPaise);
    setMode(payment.paymentMode);
    setRefundDate(todayIso());
    setReason("");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, payment?.id]);

  if (!payment) return null;

  function submit() {
    if (!payment) return;
    setError(null);
    startTransition(async () => {
      const result = await recordRefund({
        paymentId: payment.id,
        amountPaise,
        reason,
        refundDate,
        paymentMode: mode,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success(`Refund issued · invoice ${result.invoiceNumber}`);
      onOpenChange(false);
    });
  }

  const canSubmit =
    !isPending &&
    amountPaise > 0 &&
    amountPaise <= payment.amountPaise &&
    reason.trim().length >= MIN_REASON;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Record refund</SheetTitle>
          <SheetDescription>
            Issuing a refund creates a new invoice with a negative amount.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pt-2 pb-4">
          <div className="bg-muted/30 space-y-1 rounded-md border p-3 text-sm">
            <p className="text-foreground font-medium">{payment.invoiceNumber}</p>
            <p className="text-muted-foreground text-xs">
              {formatCalendarDate(payment.paymentDate)} ·{" "}
              {formatMoney(payment.amountPaise)} · {payment.paymentMode}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Refund amount</Label>
            <MoneyInput
              value={amountPaise}
              onChange={(v) => setAmountPaise(v ?? 0)}
            />
            <p className="text-muted-foreground text-xs">
              Maximum: {formatMoney(payment.amountPaise)}
            </p>
            {amountPaise > payment.amountPaise ? (
              <p className="text-destructive text-xs">
                Refund cannot exceed the original payment.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label>Refund mode</Label>
            <PaymentModeSelector value={mode} onChange={setMode} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="refund-date">Refund date</Label>
            <Input
              id="refund-date"
              type="date"
              max={todayIso()}
              value={refundDate}
              onChange={(e) => setRefundDate(e.currentTarget.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="refund-reason">Reason *</Label>
            <Textarea
              id="refund-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.currentTarget.value)}
              placeholder="Why are you issuing this refund?"
            />
            <p className="text-muted-foreground text-xs">
              {reason.trim().length}/{MIN_REASON} minimum
            </p>
          </div>

          {error ? (
            <p
              role="alert"
              className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm"
            >
              {error}
            </p>
          ) : null}
        </div>

        <SheetFooter className="border-t">
          <div className="flex w-full items-center justify-end gap-2">
            <SheetClose asChild>
              <Button type="button" variant="outline" disabled={isPending} className="w-fit">
                Cancel
              </Button>
            </SheetClose>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="text-destructive hover:text-destructive border-destructive/40 w-fit"
                  disabled={!canSubmit}
                >
                  {isPending ? <Loader2 className="size-4 animate-spin" /> : `Issue refund of ${formatMoney(amountPaise)}`}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm refund</AlertDialogTitle>
                  <AlertDialogDescription>
                    Refund {formatMoney(amountPaise)} for invoice{" "}
                    {payment.invoiceNumber}. This is permanent and creates a new
                    refund invoice.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="w-fit">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={submit}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-fit"
                  >
                    Issue refund
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
