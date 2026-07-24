"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { AddOn } from "@/lib/db/schema/add-ons";
import type { Plan } from "@/lib/db/schema/plans";
import { enrollNewMember } from "@/server/actions/enrollment/enroll-new-member";
import { EnrollmentForm } from "./enrollment-form";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  branchId: string;
  plans: Plan[];
  addOns: AddOn[];
  isFirstEnrollment: boolean;
};

export function EnrollmentSheet({
  open,
  onOpenChange,
  memberId,
  branchId,
  plans,
  addOns,
  isFirstEnrollment,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Enrol in plan</SheetTitle>
          <SheetDescription>
            One transaction creates the membership, applies add-ons, and records
            the payment with an invoice number.
          </SheetDescription>
        </SheetHeader>
        <EnrollmentForm
          config={{ plans, addOns, isFirstEnrollment }}
          onClose={() => onOpenChange(false)}
          onSubmit={async (payload) => {
            const result = await enrollNewMember({
              memberId,
              branchId,
              planId: payload.planId,
              startDate: payload.startDate ?? payload.customStartDate,
              appliedAddOnIds: payload.appliedAddOnIds,
              discountPaise: payload.discountPaise,
              discountReason: payload.discountReason,
              finalAmountPaise: payload.finalAmountPaise,
              paymentMode: payload.paymentMode,
              paymentDate: payload.paymentDate,
              paymentNotes: payload.paymentNotes,
            });
            return result.ok
              ? { ok: true, invoiceNumber: result.invoiceNumber }
              : { ok: false, message: result.message };
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
