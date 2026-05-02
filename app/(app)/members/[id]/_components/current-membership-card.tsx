"use client";

import {
  CalendarPlus,
  MoreHorizontal,
  Pause,
  Pencil,
  RefreshCcw,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MembershipStatusBadge } from "@/components/shared/membership-status-badge";
import type { CurrentMembership } from "@/server/queries/memberships/get-current-membership";
import type { Plan } from "@/lib/db/schema/plans";
import type { AddOn } from "@/lib/db/schema/add-ons";
import type { PaymentMode } from "@/lib/db/schema/payments";
import { canCorrectMembership } from "@/lib/auth/membership-permissions";
import type { Role } from "@/lib/auth/roles";
import { formatCalendarDate } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";
import { CancelMembershipDialog } from "./cancel-membership-dialog";
import { CorrectionMarker } from "./correction-marker";
import { CorrectionSheet } from "./correction-sheet";
import { EnrollmentSheet } from "./enrollment-sheet";
import { RenewalSheet } from "./renewal-sheet";

const RENEWAL_WINDOW_DAYS = 14;

type Props = {
  memberId: string;
  branchId: string;
  current: CurrentMembership | null;
  plans: Plan[];
  addOns: AddOn[];
  canEnrol: boolean;
  user: {
    id: string;
    role: Role;
    branchId: string | null;
  };
  primaryPayment: {
    id: string;
    amountPaise: number;
    paymentMode: PaymentMode;
    alreadyRefundedPaise: number;
  } | null;
};

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T00:00:00Z`);
  const b = new Date(`${toIso}T00:00:00Z`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CurrentMembershipCard({
  memberId,
  branchId,
  current,
  plans,
  addOns,
  canEnrol,
  user,
  primaryPayment,
}: Props) {
  const [enrolOpen, setEnrolOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [correctOpen, setCorrectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  if (!current) {
    return (
      <section className="bg-card rounded-xl border p-5">
        <h2 className="text-foreground mb-3 text-sm font-semibold tracking-tight">
          Current membership
        </h2>
        <div className="space-y-3">
          <p className="text-muted-foreground text-sm">
            This member has no active membership.
          </p>
          {canEnrol ? (
            <Button onClick={() => setEnrolOpen(true)}>
              <CalendarPlus className="size-4" />
              Enrol in plan
            </Button>
          ) : null}
        </div>
        <EnrollmentSheet
          open={enrolOpen}
          onOpenChange={setEnrolOpen}
          memberId={memberId}
          branchId={branchId}
          plans={plans}
          addOns={addOns}
          isFirstEnrollment={true}
        />
      </section>
    );
  }

  const today = todayIso();
  const daysToEnd = daysBetween(today, current.endDate);

  const renewEligible =
    current.effectiveStatus === "expired" ||
    (current.effectiveStatus === "active" && daysToEnd <= RENEWAL_WINDOW_DAYS);
  const renewBlockedReason =
    current.effectiveStatus === "active" && !renewEligible
      ? `Renew available ${RENEWAL_WINDOW_DAYS} days before expiry (${formatCalendarDate(current.endDate)})`
      : null;

  const correctionPermission = canCorrectMembership(user, {
    branchId: current.branchId,
    enrolledByUserId: current.enrolledByUserId,
    createdAt: current.createdAt,
  });
  const canCorrect = correctionPermission.ok;

  const isOwner = user.role === "owner";
  const showCancelMenuItem =
    isOwner &&
    (current.effectiveStatus === "active" || current.effectiveStatus === "frozen");
  const showFreezeButton = current.effectiveStatus === "active";
  const showRenewButton =
    current.effectiveStatus === "active" || current.effectiveStatus === "expired";

  return (
    <section className="bg-card rounded-xl border p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-foreground text-sm font-semibold tracking-tight">
          Current membership
        </h2>
        <MembershipStatusBadge status={current.effectiveStatus} />
      </div>
      <div className="space-y-2 text-sm">
        <p className="text-foreground font-medium">{current.planName}</p>
        <p className="text-muted-foreground">
          {current.effectiveStatus === "cancelled" ? (
            <>
              Cancelled on {formatCalendarDate(current.endDate)} · was{" "}
              {formatCalendarDate(current.startDate)} →{" "}
              {formatCalendarDate(current.endDate)}
            </>
          ) : (
            <>
              {formatCalendarDate(current.startDate)} →{" "}
              {formatCalendarDate(current.endDate)}{" "}
              {current.effectiveStatus === "active"
                ? `· Ends in ${daysToEnd} day${daysToEnd === 1 ? "" : "s"}`
                : current.effectiveStatus === "expired"
                  ? `· Expired ${Math.abs(daysToEnd)} day${Math.abs(daysToEnd) === 1 ? "" : "s"} ago`
                  : null}
            </>
          )}
        </p>
        <p className="text-foreground font-medium">
          {formatMoney(current.finalAmountPaise)}
        </p>
        {current.addOns.length > 0 ? (
          <p className="text-muted-foreground text-xs">
            Add-ons: {current.addOns.map((a) => a.name).join(", ")}
          </p>
        ) : null}
        {current.cancellationReason ? (
          <p className="text-muted-foreground text-xs">
            Reason: {current.cancellationReason}
          </p>
        ) : null}
        {current.correctedAt ? (
          <CorrectionMarker
            correctedAt={current.correctedAt}
            correctedByName={current.correctedByName}
            level={null}
            reason={null}
            before={null}
            correctionCount={current.correctionCount}
            canViewAll={user.role === "owner"}
          />
        ) : null}
      </div>

      {current.effectiveStatus === "cancelled" ? (
        canEnrol ? (
          <div className="mt-4 border-t pt-4">
            <Button onClick={() => setEnrolOpen(true)}>
              <CalendarPlus className="size-4" />
              Enrol in new plan
            </Button>
          </div>
        ) : null
      ) : (
        <div className="mt-4 flex items-center gap-2 border-t pt-4">
          {canEnrol && showRenewButton ? (
            renewBlockedReason ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>
                    <Button disabled variant="outline">
                      <RefreshCcw className="size-4" />
                      Renew
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{renewBlockedReason}</TooltipContent>
              </Tooltip>
            ) : (
              <Button onClick={() => setRenewOpen(true)}>
                <RefreshCcw className="size-4" />
                {current.effectiveStatus === "expired"
                  ? "Renew membership"
                  : "Renew"}
              </Button>
            )
          ) : null}
          {showFreezeButton ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <Button variant="outline" disabled>
                    <Pause className="size-4" />
                    Freeze
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Freeze lands in Module 06</TooltipContent>
            </Tooltip>
          ) : null}
          {canCorrect || showCancelMenuItem ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Membership actions"
                  className="ml-auto"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-auto min-w-fit">
                {canCorrect ? (
                  <DropdownMenuItem onClick={() => setCorrectOpen(true)}>
                    <Pencil className="size-4" />
                    {correctionPermission.level === "receptionist"
                      ? "Fix entry"
                      : "Correct entry"}
                  </DropdownMenuItem>
                ) : null}
                {showCancelMenuItem ? (
                  <DropdownMenuItem
                    onClick={() => setCancelOpen(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <XCircle className="size-4" />
                    Cancel membership
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      )}

      <EnrollmentSheet
        open={enrolOpen}
        onOpenChange={setEnrolOpen}
        memberId={memberId}
        branchId={branchId}
        plans={plans}
        addOns={addOns}
        isFirstEnrollment={false}
      />
      <RenewalSheet
        open={renewOpen}
        onOpenChange={setRenewOpen}
        memberId={memberId}
        branchId={branchId}
        plans={plans}
        addOns={addOns}
        previousEndDate={current.endDate}
        previousStatus={current.effectiveStatus}
        previousPlanId={current.planId}
        previousAddOnIds={current.addOns.map((a) => a.addOnId)}
      />
      {canCorrect ? (
        <CorrectionSheet
          open={correctOpen}
          onOpenChange={setCorrectOpen}
          memberId={memberId}
          current={current}
          currentPaymentMode={primaryPayment?.paymentMode ?? "cash"}
          plans={plans}
          addOns={addOns}
          level={correctionPermission.level}
        />
      ) : null}
      {showCancelMenuItem ? (
        <CancelMembershipDialog
          open={cancelOpen}
          onOpenChange={setCancelOpen}
          memberId={memberId}
          current={current}
          primaryPayment={primaryPayment}
        />
      ) : null}
    </section>
  );
}
