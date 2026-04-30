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
import type { MembershipStatus } from "@/lib/db/schema/memberships";
import { renewMembership } from "@/server/actions/enrollment/renew-membership";
import { EnrollmentForm } from "./enrollment-form";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  branchId: string;
  plans: Plan[];
  addOns: AddOn[];
  previousEndDate: string;
  previousStatus: MembershipStatus;
  previousPlanId: string | null;
  previousAddOnIds: string[];
};

export function RenewalSheet({
  open,
  onOpenChange,
  memberId,
  branchId,
  plans,
  addOns,
  previousEndDate,
  previousStatus,
  previousPlanId,
  previousAddOnIds,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Renew membership</SheetTitle>
          <SheetDescription>
            Pre-filled with the previous plan and recurring add-ons. Adjust as
            needed.
          </SheetDescription>
        </SheetHeader>
        <EnrollmentForm
          config={{
            plans,
            addOns,
            isFirstEnrollment: false,
            renewal: {
              previousEndDate,
              previousStatus,
              previousPlanId,
              previousAddOnIds,
            },
          }}
          onClose={() => onOpenChange(false)}
          onSubmit={async (payload) => {
            const result = await renewMembership({
              memberId,
              branchId,
              planId: payload.planId,
              appliedAddOnIds: payload.appliedAddOnIds,
              discountPaise: payload.discountPaise,
              discountReason: payload.discountReason,
              finalAmountPaise: payload.finalAmountPaise,
              paymentMode: payload.paymentMode,
              paymentDate: payload.paymentDate,
              paymentNotes: payload.paymentNotes,
              startMode: payload.startMode,
              customStartDate: payload.customStartDate,
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
