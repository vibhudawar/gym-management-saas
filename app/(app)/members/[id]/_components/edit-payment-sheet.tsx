"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
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
import { editPayment } from "@/server/actions/payments/edit-payment";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: MemberPaymentRow | null;
};

const MIN_REASON = 10;

export function EditPaymentSheet({ open, onOpenChange, payment }: Props) {
  const [amountPaise, setAmountPaise] = useState<number>(0);
  const [mode, setMode] = useState<PaymentMode>("cash");
  const [paymentDate, setPaymentDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !payment) return;
    // Sheet just opened with a payment — seed editable state from it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAmountPaise(payment.amountPaise);
    setMode(payment.paymentMode);
    setPaymentDate(payment.paymentDate);
    setNotes(payment.notes ?? "");
    setReason("");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, payment?.id]);

  if (!payment) return null;

  function submit() {
    if (!payment) return;
    setError(null);
    startTransition(async () => {
      const result = await editPayment({
        paymentId: payment.id,
        amountPaise: amountPaise !== payment.amountPaise ? amountPaise : undefined,
        paymentMode: mode !== payment.paymentMode ? mode : undefined,
        paymentDate: paymentDate !== payment.paymentDate ? paymentDate : undefined,
        notes: notes !== (payment.notes ?? "") ? (notes.trim() ? notes : null) : undefined,
        reason,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success("Payment updated");
      onOpenChange(false);
    });
  }

  const canSubmit = !isPending && reason.trim().length >= MIN_REASON;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit payment</SheetTitle>
          <SheetDescription>
            Audited. Use this only for typo corrections.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pt-2 pb-4">
          <div className="border-amber-500/30 bg-amber-500/5 flex items-start gap-2 rounded-md border p-3 text-xs">
            <AlertCircle className="text-amber-600 mt-0.5 size-4 shrink-0" />
            <p>
              Editing a payment is logged in the audit trail. To reverse a
              payment, use{" "}
              <span className="text-foreground font-medium">Record refund</span>{" "}
              instead.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Amount</Label>
            <MoneyInput
              value={amountPaise}
              onChange={(v) => setAmountPaise(v ?? 0)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Mode</Label>
            <PaymentModeSelector value={mode} onChange={setMode} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-payment-date">Date</Label>
            <Input
              id="edit-payment-date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.currentTarget.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-payment-notes">Notes</Label>
            <Textarea
              id="edit-payment-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-payment-reason">Reason for edit *</Label>
            <Textarea
              id="edit-payment-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.currentTarget.value)}
              placeholder="What was wrong, and what's correct?"
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
            <Button onClick={submit} disabled={!canSubmit} className="w-fit">
              {isPending ? <Loader2 className="size-4 animate-spin" /> : "Save changes"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
