"use client";

import {
  CalendarPlus,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
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
import type { CurrentFreeze } from "@/server/queries/freezes/get-current-freeze";
import type { CurrentMembership } from "@/server/queries/memberships/get-current-membership";
import type { Plan } from "@/lib/db/schema/plans";
import type { AddOn } from "@/lib/db/schema/add-ons";
import type { PaymentMode } from "@/lib/db/schema/payments";
import { canCorrectMembership } from "@/lib/auth/membership-permissions";
import { isManagerOrOwner, type Role } from "@/lib/auth/roles";
import { formatCalendarDate } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";
import { CancelMembershipDialog } from "./cancel-membership-dialog";
import { CorrectionMarker } from "./correction-marker";
import { CorrectionSheet } from "./correction-sheet";
import { EnrollmentSheet } from "./enrollment-sheet";
import { FreezeSheet } from "./freeze-sheet";
import { RenewalSheet } from "./renewal-sheet";
import { UnfreezeSheet } from "./unfreeze-sheet";

const RENEWAL_WINDOW_DAYS = 14;

type Props = {
  memberId: string;
  memberName: string;
  branchId: string;
  current: CurrentMembership | null;
  currentFreeze: CurrentFreeze | null;
  pastFreezeCount: number;
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

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function CurrentMembershipCard({
  memberId,
  memberName,
  branchId,
  current,
  currentFreeze,
  pastFreezeCount,
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
  const [freezeOpen, setFreezeOpen] = useState(false);
  const [unfreezeOpen, setUnfreezeOpen] = useState(false);

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
  const canManage = isManagerOrOwner(user.role);
  const showCancelMenuItem =
    isOwner &&
    (current.effectiveStatus === "active" || current.effectiveStatus === "frozen");
  // Freeze button shows when active and there's no upcoming freeze already
  // queued (one freeze at a time per spec).
  const showFreezeButton =
    canEnrol &&
    canManage &&
    current.effectiveStatus === "active" &&
    !currentFreeze;
  const showUnfreezeButton =
    canEnrol &&
    canManage &&
    current.effectiveStatus === "frozen" &&
    currentFreeze !== null;
  const showRenewButton =
    current.effectiveStatus === "active" || current.effectiveStatus === "expired";
  const renewBlockedByFreeze = current.effectiveStatus === "frozen";

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
        {current.effectiveStatus === "frozen" && currentFreeze ? (
          <div className="border-amber-500/30 bg-amber-500/5 space-y-1 rounded-md border px-3 py-2 text-xs">
            <p className="text-foreground">
              <Pause className="mr-1 inline size-3 fill-amber-600 text-amber-600" />
              Frozen {formatCalendarDate(currentFreeze.freezeStartDate)} →{" "}
              {formatCalendarDate(currentFreeze.freezeEndDate)} (
              {currentFreeze.daysAdded} day{currentFreeze.daysAdded === 1 ? "" : "s"})
            </p>
            <p className="text-muted-foreground">
              Resumes{" "}
              {formatCalendarDate(
                addDaysIso(currentFreeze.freezeEndDate, 1),
              )}{" "}
              · End date {formatCalendarDate(current.endDate)}
            </p>
            <p className="text-foreground/80">
              Reason: {currentFreeze.reason}
            </p>
          </div>
        ) : null}
        {current.effectiveStatus === "active" &&
        currentFreeze?.effectiveStatus === "scheduled" ? (
          <p className="text-amber-700 inline-flex items-center gap-1 text-xs italic">
            <Pause className="size-3 fill-amber-700" />
            Freeze scheduled{" "}
            {formatCalendarDate(currentFreeze.freezeStartDate)} →{" "}
            {formatCalendarDate(currentFreeze.freezeEndDate)}
          </p>
        ) : null}
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
            renewBlockedByFreeze ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>
                    <Button disabled variant="outline">
                      <RefreshCcw className="size-4" />
                      Renew
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Cannot renew while frozen. Unfreeze first or wait for
                  scheduled resume.
                </TooltipContent>
              </Tooltip>
            ) : renewBlockedReason ? (
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
            <Button variant="outline" onClick={() => setFreezeOpen(true)}>
              <Pause className="size-4" />
              Freeze
            </Button>
          ) : null}
          {showUnfreezeButton ? (
            <Button onClick={() => setUnfreezeOpen(true)}>
              <Play className="size-4" />
              Unfreeze now
            </Button>
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
      {canManage ? (
        <FreezeSheet
          open={freezeOpen}
          onOpenChange={setFreezeOpen}
          memberId={memberId}
          membershipId={current.id}
          memberName={memberName}
          planName={current.planName}
          membershipEndDate={current.endDate}
          pastFreezeCount={pastFreezeCount}
        />
      ) : null}
      {canManage && currentFreeze ? (
        <UnfreezeSheet
          open={unfreezeOpen}
          onOpenChange={setUnfreezeOpen}
          memberId={memberId}
          memberName={memberName}
          planName={current.planName}
          freeze={currentFreeze}
          membershipEndDate={current.endDate}
        />
      ) : null}
    </section>
  );
}
