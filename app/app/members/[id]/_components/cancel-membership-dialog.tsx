"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/shared/money-input";
import { PaymentModeSelector } from "@/components/shared/payment-mode-selector";
import type { CurrentMembership } from "@/server/queries/memberships/get-current-membership";
import type { PaymentMode } from "@/lib/db/schema/payments";
import { MIN_REASON_CHARS } from "@/lib/constants/validation";
import { formatCalendarDate, todayIstIso } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";
import { cancelMembership } from "@/server/actions/memberships/cancel-membership";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  current: CurrentMembership;
  primaryPayment: { id: string; amountPaise: number; alreadyRefundedPaise: number } | null;
  /** Pre-populated reason (e.g. when triggered from a full-refund flow). */
  initialReason?: string;
};

// daysBetween (non-inclusive) is distinct from `daysBetweenInclusiveIso` —
// kept local because this dialog needs elapsed-days semantics.
function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T00:00:00Z`);
  const b = new Date(`${toIso}T00:00:00Z`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function CancelMembershipDialog({
  open,
  onOpenChange,
  memberId,
  current,
  primaryPayment,
  initialReason,
}: Props) {
  const [effectiveDate, setEffectiveDate] = useState<string>(todayIstIso());
  const [reason, setReason] = useState("");
  const [issueRefund, setIssueRefund] = useState(false);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundMode, setRefundMode] = useState<PaymentMode>("cash");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEffectiveDate(todayIstIso());
    setReason(initialReason ?? "");
    setIssueRefund(false);
    setRefundAmount(0);
    setRefundMode("cash");
    setError(null);
  }, [open, current.id, initialReason]);

  const totalDays = Math.max(
    1,
    daysBetween(current.startDate, current.endDate),
  );
  const usedDays = Math.max(
    0,
    Math.min(totalDays, daysBetween(current.startDate, effectiveDate)),
  );
  const unusedDays = totalDays - usedDays;
  const refundable = primaryPayment
    ? primaryPayment.amountPaise + primaryPayment.alreadyRefundedPaise
    : 0;
  const suggestedRefund = primaryPayment
    ? Math.min(
        refundable,
        Math.max(
          0,
          Math.floor((primaryPayment.amountPaise * unusedDays) / totalDays),
        ),
      )
    : 0;

  const reasonTooShort = reason.trim().length < MIN_REASON_CHARS;
  const refundTooLarge = issueRefund && refundAmount > refundable;
  const refundInvalid = issueRefund && refundAmount <= 0;
  const canSubmit =
    !reasonTooShort && !refundTooLarge && !refundInvalid && !isPending;

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await cancelMembership({
        membershipId: current.id,
        effectiveDate,
        reason: reason.trim(),
        ...(issueRefund && primaryPayment
          ? {
              refund: {
                paymentId: primaryPayment.id,
                amountPaise: refundAmount,
                paymentMode: refundMode,
              },
            }
          : {}),
        memberId,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success(
        result.refund && result.refund.ok
          ? `Membership cancelled · refund invoice ${result.refund.invoiceNumber}`
          : "Membership cancelled",
      );
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel membership</DialogTitle>
          <DialogDescription>
            This ends the member&rsquo;s current membership. History is preserved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="bg-muted/30 space-y-1 rounded-md border p-3 text-xs">
            <p className="text-foreground font-medium">{current.planName}</p>
            <p className="text-muted-foreground">
              {formatCalendarDate(current.startDate)} →{" "}
              {formatCalendarDate(current.endDate)}
            </p>
            {primaryPayment ? (
              <p className="text-muted-foreground">
                Paid: {formatMoney(primaryPayment.amountPaise)} · Refundable:{" "}
                {formatMoney(refundable)}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cancel-effective">Effective date *</Label>
            <Input
              id="cancel-effective"
              type="date"
              min={current.startDate}
              max={todayIstIso()}
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.currentTarget.value)}
            />
            <p className="text-muted-foreground text-xs">
              {usedDays} of {totalDays} days used · {unusedDays} unused
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason">Reason *</Label>
            <Textarea
              id="cancel-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.currentTarget.value)}
              placeholder="Why is this membership being cancelled?"
            />
            <p className="text-muted-foreground text-xs">
              {reason.trim().length}/{MIN_REASON_CHARS} minimum
            </p>
          </div>

          {primaryPayment && refundable > 0 ? (
            <div className="space-y-3 border-t pt-3">
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={issueRefund}
                  onCheckedChange={(v) => {
                    const next = v === true;
                    setIssueRefund(next);
                    if (next && refundAmount === 0) {
                      setRefundAmount(suggestedRefund);
                    }
                  }}
                />
                <span>Issue a refund as part of this cancellation</span>
              </label>
              {issueRefund ? (
                <div className="space-y-3 pl-6">
                  <div className="space-y-1.5">
                    <Label>Refund amount</Label>
                    <MoneyInput
                      value={refundAmount}
                      onChange={(v) => setRefundAmount(v ?? 0)}
                    />
                    <div className="text-muted-foreground flex items-center gap-2 text-xs">
                      <span>Suggested:</span>
                      <button
                        type="button"
                        onClick={() => setRefundAmount(suggestedRefund)}
                        className="border-border hover:bg-muted/50 rounded-full border px-2 py-0.5"
                      >
                        Use {formatMoney(suggestedRefund)} ({unusedDays}/
                        {totalDays} unused days)
                      </button>
                    </div>
                    {refundTooLarge ? (
                      <p className="text-destructive text-xs">
                        Cannot exceed refundable amount{" "}
                        {formatMoney(refundable)}.
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Refund mode</Label>
                    <PaymentModeSelector
                      value={refundMode}
                      onChange={setRefundMode}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm"
            >
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="w-fit"
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!canSubmit}
            variant="outline"
            className="border-destructive/40 text-destructive hover:bg-destructive/10 w-fit"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Cancel membership"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
