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
import { SheetClose, SheetFooter } from "@/components/ui/sheet";
import {
  buildInitialEnrollmentState,
  deriveEnrollment,
  EnrollmentFields,
  type EnrollmentFieldsConfig,
  type EnrollmentFieldsState,
  type StartMode,
} from "@/components/forms/enrollment-fields";
import type { PaymentMode } from "@/lib/db/schema/payments";
import { formatMoney } from "@/lib/utils/money";

export type EnrollmentFormSubmitPayload = {
  planId: string;
  appliedAddOnIds: string[];
  discountPaise: number;
  discountReason: string | null;
  finalAmountPaise: number;
  paymentMode: PaymentMode;
  paymentDate: string;
  paymentNotes: string | null;
  startDate?: string;
  startMode?: StartMode;
  customStartDate?: string;
};

export type EnrollmentFormProps = {
  config: EnrollmentFieldsConfig;
  onSubmit: (payload: EnrollmentFormSubmitPayload) => Promise<{
    ok: boolean;
    message?: string;
    invoiceNumber?: string;
  }>;
  onClose: () => void;
};

export function EnrollmentForm({
  config,
  onSubmit,
  onClose,
}: EnrollmentFormProps) {
  const [state, setState] = useState<EnrollmentFieldsState>(() =>
    buildInitialEnrollmentState(config),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const derived = deriveEnrollment(state, config);
  const canSubmit =
    !!derived.selectedPlan &&
    !derived.discountTooLarge &&
    !derived.reasonMissing &&
    !isPending;

  useEffect(() => {
    // Clear server-error banner when the user picks a different plan.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
  }, [state.planId]);

  function submit() {
    if (!derived.selectedPlan) return;
    setError(null);
    startTransition(async () => {
      const payload: EnrollmentFormSubmitPayload = {
        planId: state.planId,
        appliedAddOnIds: [...state.appliedAddOnIds],
        discountPaise: state.discountPaise,
        discountReason:
          state.discountPaise > 0 ? state.discountReason.trim() : null,
        finalAmountPaise: derived.finalAmount,
        paymentMode: state.paymentMode,
        paymentDate: state.paymentDate,
        paymentNotes: state.paymentNotes.trim()
          ? state.paymentNotes.trim()
          : null,
        ...(config.renewal
          ? {
              startMode: state.startMode,
              customStartDate:
                state.startMode === "custom"
                  ? state.customStartDate
                  : undefined,
            }
          : { startDate: derived.startDate }),
      };
      const result = await onSubmit(payload);
      if (!result.ok) {
        setError(result.message ?? "Could not complete enrolment.");
        return;
      }
      toast.success(
        result.invoiceNumber
          ? `Enrolment complete · invoice ${result.invoiceNumber}`
          : "Enrolment complete",
      );
      onClose();
    });
  }

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-4">
        <EnrollmentFields config={config} state={state} setState={setState} />
        {error ? (
          <p
            role="alert"
            className="border-destructive/30 bg-destructive/5 text-destructive mt-4 rounded-md border px-3 py-2 text-sm"
          >
            {error}
          </p>
        ) : null}
      </div>
      <SheetFooter className="border-t">
        <div className="flex w-full items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs">
            {derived.selectedPlan
              ? `Will charge ${formatMoney(derived.finalAmount)} via ${state.paymentMode.replace("_", " ")}.`
              : ""}
          </p>
          <div className="flex items-center gap-2">
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
                <Button disabled={!canSubmit} className="w-fit">
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Confirm enrolment"
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm enrolment</AlertDialogTitle>
                  <AlertDialogDescription>
                    Charge {formatMoney(derived.finalAmount)} via{" "}
                    {state.paymentMode.replace("_", " ")} for{" "}
                    {derived.selectedPlan?.name}? An invoice is created and the
                    payment is recorded immediately.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="w-fit">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={submit} className="w-fit">
                    Confirm
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </SheetFooter>
    </>
  );
}
