"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { CurrentMembership } from "@/server/queries/memberships/get-current-membership";
import type { AddOn } from "@/lib/db/schema/add-ons";
import type { Plan } from "@/lib/db/schema/plans";
import type { PaymentMode } from "@/lib/db/schema/payments";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils";
import { correctMembership } from "@/server/actions/memberships/correct-membership";

const MIN_REASON_CHARS = 10;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  current: CurrentMembership;
  currentPaymentMode: PaymentMode;
  plans: Plan[];
  addOns: AddOn[];
  level: "receptionist" | "manager" | "owner";
};

const LEVEL_LABEL: Record<Props["level"], string> = {
  receptionist: "Receptionist",
  manager: "Branch Manager",
  owner: "Owner",
};

export function CorrectionSheet({
  open,
  onOpenChange,
  memberId,
  current,
  currentPaymentMode,
  plans,
  addOns,
  level,
}: Props) {
  const activePlans = useMemo(() => plans.filter((p) => p.isActive), [plans]);
  const activeAddOns = useMemo(
    () => addOns.filter((a) => a.isActive),
    [addOns],
  );

  const [planId, setPlanId] = useState(current.planId);
  const [appliedAddOnIds, setAppliedAddOnIds] = useState<Set<string>>(
    new Set(current.addOns.map((a) => a.addOnId)),
  );
  const [discountPaise, setDiscountPaise] = useState<number>(
    current.discountPaise,
  );
  const [discountReason, setDiscountReason] = useState<string>(
    current.discountReason ?? "",
  );
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(currentPaymentMode);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    // Reset to current values whenever the sheet (re)opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlanId(current.planId);
    setAppliedAddOnIds(new Set(current.addOns.map((a) => a.addOnId)));
    setDiscountPaise(current.discountPaise);
    setDiscountReason(current.discountReason ?? "");
    setPaymentMode(currentPaymentMode);
    setReason("");
    setError(null);
  }, [open, current, currentPaymentMode]);

  const selectedPlan = activePlans.find((p) => p.id === planId);
  const selectedAddOns = activeAddOns.filter((a) => appliedAddOnIds.has(a.id));
  const planPrice = selectedPlan?.defaultPricePaise ?? 0;
  const addonsTotal = selectedAddOns.reduce(
    (sum, a) => sum + a.amountPaise,
    0,
  );
  const subtotal = planPrice + addonsTotal;
  const finalAmount = Math.max(0, subtotal - discountPaise);

  const reasonTooShort = reason.trim().length < MIN_REASON_CHARS;
  const discountTooLarge = discountPaise > subtotal;
  const reasonForDiscountMissing =
    discountPaise > 0 && discountReason.trim().length < 3;
  const canSubmit =
    !!selectedPlan &&
    !discountTooLarge &&
    !reasonForDiscountMissing &&
    !reasonTooShort &&
    !isPending;

  function toggleAddOn(id: string, checked: boolean) {
    setAppliedAddOnIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function submit() {
    if (!selectedPlan) return;
    setError(null);
    startTransition(async () => {
      const result = await correctMembership({
        membershipId: current.id,
        planId,
        appliedAddOnIds: [...appliedAddOnIds],
        discountPaise,
        discountReason: discountPaise > 0 ? discountReason.trim() : null,
        paymentMode,
        reason: reason.trim(),
        memberId,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success("Correction saved");
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Correct membership</SheetTitle>
          <SheetDescription>
            Recorded as a correction in the audit trail. Original entry
            preserved.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pt-2 pb-4">
          <div className="border-amber-500/30 bg-amber-500/5 flex items-start gap-2 rounded-md border p-3 text-xs">
            <AlertCircle className="text-amber-600 mt-0.5 size-4 shrink-0" />
            <div className="space-y-0.5">
              <p className="text-foreground font-medium">
                Corrections are logged in the audit trail.
              </p>
              <p className="text-muted-foreground">
                Acting as: {LEVEL_LABEL[level]}
              </p>
            </div>
          </div>

          <section className="space-y-2">
            <h3 className="text-foreground text-sm font-semibold tracking-tight">
              Original entry
            </h3>
            <div className="bg-muted/30 space-y-1 rounded-md border p-3 text-sm">
              <p className="text-foreground font-medium">{current.planName}</p>
              <p className="text-muted-foreground text-xs">
                {formatMoney(current.finalAmountPaise)}
                {current.addOns.length > 0
                  ? ` · ${current.addOns.map((a) => a.name).join(", ")}`
                  : ""}
                {currentPaymentMode ? ` · ${currentPaymentMode}` : ""}
              </p>
              {current.discountReason ? (
                <p className="text-muted-foreground text-xs">
                  Discount reason: {current.discountReason}
                </p>
              ) : null}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-foreground text-sm font-semibold tracking-tight">
              Corrected values
            </h3>
            <div className="space-y-2">
              <Label htmlFor="correct-plan">Plan</Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger id="correct-plan">
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  {activePlans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {p.durationDays} days ·{" "}
                      {formatMoney(p.defaultPricePaise)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {activeAddOns.length > 0 ? (
              <div className="space-y-2">
                <Label>Add-ons</Label>
                <ul className="space-y-2">
                  {activeAddOns.map((a) => {
                    const checked = appliedAddOnIds.has(a.id);
                    return (
                      <li key={a.id}>
                        <label className="hover:bg-muted/30 flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm transition-colors">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) =>
                              toggleAddOn(a.id, v === true)
                            }
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-foreground font-medium">
                              {a.name}
                            </p>
                          </div>
                          <span className="text-foreground tabular-nums">
                            {formatMoney(a.amountPaise)}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <div className="bg-muted/30 space-y-2 rounded-md border p-4 text-sm">
              <Row label="Plan price" value={formatMoney(planPrice)} />
              {selectedAddOns.map((a) => (
                <Row
                  key={a.id}
                  label={a.name}
                  value={formatMoney(a.amountPaise)}
                  muted
                />
              ))}
              <div className="border-border my-2 border-t" />
              <Row label="Subtotal" value={formatMoney(subtotal)} bold />
              <Row
                label="Discount"
                value={
                  <MoneyInput
                    value={discountPaise}
                    onChange={(v) => setDiscountPaise(v ?? 0)}
                    className="w-32"
                  />
                }
              />
              {discountPaise > 0 ? (
                <div className="space-y-1.5">
                  <Label htmlFor="correct-discount-reason" className="text-xs">
                    Reason for discount *
                  </Label>
                  <Textarea
                    id="correct-discount-reason"
                    rows={2}
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.currentTarget.value)}
                  />
                </div>
              ) : null}
              {discountTooLarge ? (
                <p className="text-destructive text-xs">
                  Discount cannot exceed {formatMoney(subtotal)}.
                </p>
              ) : null}
              <div className="border-border my-1 border-t" />
              <Row label="Total" value={formatMoney(finalAmount)} bold lg />
            </div>

            <div className="space-y-2">
              <Label>Payment mode</Label>
              <PaymentModeSelector
                value={paymentMode}
                onChange={setPaymentMode}
              />
            </div>
          </section>

          <section className="space-y-2">
            <Label htmlFor="correct-reason">Reason for correction *</Label>
            <Textarea
              id="correct-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.currentTarget.value)}
              placeholder="Wrong plan selected at desk · Member changed to quarterly · Discount missing"
            />
            <p className="text-muted-foreground text-xs">
              {reason.trim().length}/{MIN_REASON_CHARS} minimum
            </p>
          </section>

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
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                className="w-fit"
              >
                Cancel
              </Button>
            </SheetClose>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="border-amber-500/40 text-amber-700 hover:bg-amber-500/10 w-fit"
                  disabled={!canSubmit}
                >
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Save correction"
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Save correction?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The membership and the linked payment will both be updated.
                    This is logged in the audit trail.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="w-fit">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={submit} className="w-fit">
                    Save correction
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

function Row({
  label,
  value,
  bold,
  muted,
  lg,
}: {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
  muted?: boolean;
  lg?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 text-sm",
        muted && "text-muted-foreground",
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "tabular-nums",
          bold && "text-foreground font-semibold",
          lg && "text-base",
        )}
      >
        {value}
      </span>
    </div>
  );
}
