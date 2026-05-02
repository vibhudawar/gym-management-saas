"use client";

import { useEffect, useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { MoneyInput } from "@/components/shared/money-input";
import { PaymentModeSelector } from "@/components/shared/payment-mode-selector";
import type { AddOn } from "@/lib/db/schema/add-ons";
import type { MembershipStatus } from "@/lib/db/schema/memberships";
import type { PaymentMode } from "@/lib/db/schema/payments";
import type { Plan } from "@/lib/db/schema/plans";
import { formatCalendarDate } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils";

export type StartMode = "from_today" | "from_previous_end" | "custom";

export type RenewalPrefill = {
  previousEndDate: string;
  previousStatus: MembershipStatus;
  previousPlanId: string | null;
  previousAddOnIds: string[];
};

export type EnrollmentFieldsState = {
  planId: string;
  appliedAddOnIds: Set<string>;
  discountPaise: number;
  discountReason: string;
  paymentMode: PaymentMode;
  paymentDate: string;
  paymentNotes: string;
  startMode: StartMode;
  customStartDate: string;
};

export type EnrollmentFieldsConfig = {
  plans: Plan[];
  addOns: AddOn[];
  isFirstEnrollment: boolean;
  renewal?: RenewalPrefill;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isPreviousPlanInactive(config: EnrollmentFieldsConfig): boolean {
  if (!config.renewal?.previousPlanId) return false;
  const activePlans = config.plans.filter((p) => p.isActive);
  return !activePlans.some((p) => p.id === config.renewal!.previousPlanId);
}

export function buildInitialEnrollmentState(
  config: EnrollmentFieldsConfig,
): EnrollmentFieldsState {
  const activePlans = config.plans.filter((p) => p.isActive);
  const activeAddOns = config.addOns.filter((a) => a.isActive);
  const previousPlanInactive = isPreviousPlanInactive(config);

  const initialPlanId = (() => {
    if (config.renewal) {
      // If the previous plan was deactivated, leave the picker empty so the user
      // makes a deliberate choice (and the notice can render).
      if (previousPlanInactive) return "";
      return config.renewal.previousPlanId ?? activePlans[0]?.id ?? "";
    }
    return activePlans[0]?.id ?? "";
  })();

  const initialAddOnIds: string[] = (() => {
    if (config.renewal) {
      // Wipe add-ons too when the previous plan is gone — the user is rebuilding
      // the enrolment from scratch.
      if (previousPlanInactive) return [];
      return config.renewal.previousAddOnIds.filter((id) =>
        activeAddOns.some((a) => a.id === id && a.type === "recurring"),
      );
    }
    if (config.isFirstEnrollment) {
      return activeAddOns
        .filter((a) => a.autoApplyOnFirstEnrollment)
        .map((a) => a.id);
    }
    return [];
  })();

  return {
    planId: initialPlanId,
    appliedAddOnIds: new Set(initialAddOnIds),
    discountPaise: 0,
    discountReason: "",
    paymentMode: "cash",
    paymentDate: todayIso(),
    paymentNotes: "",
    startMode: config.renewal
      ? config.renewal.previousStatus === "expired"
        ? "from_today"
        : "from_previous_end"
      : "custom",
    customStartDate: config.renewal
      ? addDaysIso(config.renewal.previousEndDate, 1)
      : todayIso(),
  };
}

export type EnrollmentDerived = {
  selectedPlan: Plan | undefined;
  subtotal: number;
  finalAmount: number;
  startDate: string;
  computedEndDate: string | null;
  reasonMissing: boolean;
  discountTooLarge: boolean;
};

export function deriveEnrollment(
  state: EnrollmentFieldsState,
  config: EnrollmentFieldsConfig,
): EnrollmentDerived {
  const activePlans = config.plans.filter((p) => p.isActive);
  const activeAddOns = config.addOns.filter((a) => a.isActive);
  const selectedPlan = activePlans.find((p) => p.id === state.planId);
  const selectedAddOns = activeAddOns.filter((a) =>
    state.appliedAddOnIds.has(a.id),
  );
  const planPrice = selectedPlan?.defaultPricePaise ?? 0;
  const addonsTotal = selectedAddOns.reduce(
    (sum, a) => sum + a.amountPaise,
    0,
  );
  const subtotal = planPrice + addonsTotal;
  const finalAmount = Math.max(0, subtotal - state.discountPaise);

  const startDate = (() => {
    if (!config.renewal) return state.customStartDate;
    if (state.startMode === "from_today") return todayIso();
    if (state.startMode === "from_previous_end")
      return addDaysIso(config.renewal.previousEndDate, 1);
    return state.customStartDate;
  })();

  const computedEndDate = selectedPlan
    ? addDaysIso(startDate, selectedPlan.durationDays)
    : null;

  return {
    selectedPlan,
    subtotal,
    finalAmount,
    startDate,
    computedEndDate,
    reasonMissing:
      state.discountPaise > 0 && state.discountReason.trim().length < 3,
    discountTooLarge: state.discountPaise > subtotal,
  };
}

type EnrollmentFieldsProps = {
  config: EnrollmentFieldsConfig;
  state: EnrollmentFieldsState;
  setState: React.Dispatch<React.SetStateAction<EnrollmentFieldsState>>;
};

export function EnrollmentFields({
  config,
  state,
  setState,
}: EnrollmentFieldsProps) {
  const { plans, addOns, isFirstEnrollment, renewal } = config;
  const activePlans = useMemo(() => plans.filter((p) => p.isActive), [plans]);
  const activeAddOns = useMemo(
    () => addOns.filter((a) => a.isActive),
    [addOns],
  );

  const previousPlanInactive = useMemo(
    () =>
      !!renewal?.previousPlanId &&
      !activePlans.some((p) => p.id === renewal.previousPlanId),
    [renewal, activePlans],
  );

  // Reset state when config-derived initial values shift (e.g. renewal data arrives).
  const initialPlanId = useMemo(() => {
    if (renewal) {
      if (previousPlanInactive) return "";
      return renewal.previousPlanId ?? activePlans[0]?.id ?? "";
    }
    return activePlans[0]?.id ?? "";
  }, [renewal, previousPlanInactive, activePlans]);
  const initialAddOnSig = useMemo(() => {
    if (renewal) {
      if (previousPlanInactive) return "";
      return renewal.previousAddOnIds
        .filter((id) =>
          activeAddOns.some((a) => a.id === id && a.type === "recurring"),
        )
        .join(",");
    }
    if (isFirstEnrollment) {
      return activeAddOns
        .filter((a) => a.autoApplyOnFirstEnrollment)
        .map((a) => a.id)
        .join(",");
    }
    return "";
  }, [renewal, previousPlanInactive, isFirstEnrollment, activeAddOns]);

  useEffect(() => {
    // Pre-fill changes need to flow into local state when the config shifts.
    setState((prev) => ({
      ...prev,
      planId: initialPlanId,
      appliedAddOnIds: new Set(initialAddOnSig ? initialAddOnSig.split(",") : []),
    }));
  }, [initialPlanId, initialAddOnSig, setState]);

  const derived = deriveEnrollment(state, config);
  const selectedAddOns = activeAddOns.filter((a) =>
    state.appliedAddOnIds.has(a.id),
  );

  function setPlan(id: string) {
    setState((s) => ({ ...s, planId: id }));
  }
  function toggleAddOn(id: string, checked: boolean) {
    setState((s) => {
      const next = new Set(s.appliedAddOnIds);
      if (checked) next.add(id);
      else next.delete(id);
      return { ...s, appliedAddOnIds: next };
    });
  }
  function setDiscount(paise: number) {
    setState((s) => ({ ...s, discountPaise: paise }));
  }
  function setDiscountReason(reason: string) {
    setState((s) => ({ ...s, discountReason: reason }));
  }
  function setPaymentMode(mode: PaymentMode) {
    setState((s) => ({ ...s, paymentMode: mode }));
  }
  function setPaymentDate(date: string) {
    setState((s) => ({ ...s, paymentDate: date }));
  }
  function setPaymentNotes(notes: string) {
    setState((s) => ({ ...s, paymentNotes: notes }));
  }
  function setStartMode(mode: StartMode) {
    setState((s) => ({ ...s, startMode: mode }));
  }
  function setCustomStartDate(date: string) {
    setState((s) => ({ ...s, customStartDate: date }));
  }

  return (
    <div className="space-y-6">
      <Section title="Plan">
        <div className="space-y-2">
          <Label htmlFor="enrol-plan">Plan</Label>
          <Select value={state.planId} onValueChange={setPlan}>
            <SelectTrigger id="enrol-plan">
              <SelectValue placeholder="Select a plan" />
            </SelectTrigger>
            <SelectContent>
              {activePlans.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} · {p.durationDays} days · {formatMoney(p.defaultPricePaise)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {previousPlanInactive ? (
            <p className="text-amber-700 text-xs">
              Previous plan is no longer active. Pick a new plan.
            </p>
          ) : null}
          {derived.selectedPlan && derived.computedEndDate ? (
            <p className="text-muted-foreground text-xs">
              {formatMoney(derived.selectedPlan.defaultPricePaise)} ·{" "}
              {derived.selectedPlan.durationDays} days · ends{" "}
              {formatCalendarDate(derived.computedEndDate)}
            </p>
          ) : null}
        </div>
      </Section>

      {activeAddOns.length > 0 ? (
        <Section title="Add-ons">
          <ul className="space-y-2">
            {activeAddOns.map((a) => {
              const checked = state.appliedAddOnIds.has(a.id);
              return (
                <li key={a.id}>
                  <label className="hover:bg-muted/30 flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm transition-colors">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => toggleAddOn(a.id, v === true)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground font-medium">
                        {a.name}{" "}
                        <span className="text-muted-foreground ml-1 text-[10px] uppercase tracking-wide">
                          {a.type === "one_time" ? "One-time" : "Recurring"}
                        </span>
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
        </Section>
      ) : null}

      <Section title="Pricing">
        <div className="bg-muted/30 space-y-2 rounded-md border p-4 text-sm">
          <Row label="Plan price" value={formatMoney(derived.selectedPlan?.defaultPricePaise ?? 0)} />
          {selectedAddOns.map((a) => (
            <Row key={a.id} label={a.name} value={formatMoney(a.amountPaise)} muted />
          ))}
          <div className="border-border my-2 border-t" />
          <Row label="Subtotal" value={formatMoney(derived.subtotal)} bold />
          <div className="space-y-1.5">
            <Row
              label="Discount"
              value={
                <MoneyInput
                  value={state.discountPaise}
                  onChange={(v) => setDiscount(v ?? 0)}
                  className="w-32"
                />
              }
            />
            {state.discountPaise > 0 ? (
              <div className="space-y-1.5">
                <Label htmlFor="discount-reason" className="text-xs">
                  Reason for discount *
                </Label>
                <Textarea
                  id="discount-reason"
                  rows={2}
                  value={state.discountReason}
                  onChange={(e) => setDiscountReason(e.currentTarget.value)}
                  placeholder="e.g. corporate tie-up, festive offer"
                />
                {derived.reasonMissing ? (
                  <p className="text-destructive text-xs">
                    Reason is required when applying a discount.
                  </p>
                ) : null}
              </div>
            ) : null}
            {derived.discountTooLarge ? (
              <p className="text-destructive text-xs">
                Discount cannot exceed {formatMoney(derived.subtotal)}.
              </p>
            ) : null}
          </div>
          <div className="border-border my-1 border-t" />
          <Row label="Total" value={formatMoney(derived.finalAmount)} bold lg />
        </div>
      </Section>

      <Section title="Start date">
        {renewal ? (
          <div className="space-y-2">
            <ToggleGroup
              type="single"
              value={state.startMode}
              onValueChange={(v) => v && setStartMode(v as StartMode)}
              variant="outline"
              className="w-full"
            >
              <ToggleGroupItem
                value="from_previous_end"
                className="flex-1 text-xs"
              >
                From end of previous
              </ToggleGroupItem>
              <ToggleGroupItem value="from_today" className="flex-1 text-xs">
                From today
              </ToggleGroupItem>
              <ToggleGroupItem value="custom" className="flex-1 text-xs">
                Custom
              </ToggleGroupItem>
            </ToggleGroup>
            <p className="text-muted-foreground text-xs">
              {state.startMode === "from_previous_end" ? (
                <>
                  Membership will start on{" "}
                  <span className="text-foreground font-medium">
                    {formatCalendarDate(
                      addDaysIso(renewal.previousEndDate, 1),
                    )}
                  </span>{" "}
                  (day after current end date).
                </>
              ) : state.startMode === "from_today" ? (
                <>
                  Membership will start on{" "}
                  <span className="text-foreground font-medium">
                    {formatCalendarDate(todayIso())}
                  </span>
                  .
                </>
              ) : (
                "Pick a custom start date below."
              )}
            </p>
            {state.startMode === "custom" ? (
              <Input
                type="date"
                value={state.customStartDate}
                onChange={(e) => setCustomStartDate(e.currentTarget.value)}
              />
            ) : null}
          </div>
        ) : (
          <Input
            type="date"
            value={state.customStartDate}
            onChange={(e) => setCustomStartDate(e.currentTarget.value)}
          />
        )}
        {derived.selectedPlan && derived.computedEndDate ? (
          <p className="text-muted-foreground text-xs">
            Membership runs until {formatCalendarDate(derived.computedEndDate)}
          </p>
        ) : null}
      </Section>

      <Section title="Payment">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Mode</Label>
            <PaymentModeSelector
              value={state.paymentMode}
              onChange={setPaymentMode}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payment-date">Payment date</Label>
            <Input
              id="payment-date"
              type="date"
              max={todayIso()}
              value={state.paymentDate}
              onChange={(e) => setPaymentDate(e.currentTarget.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payment-notes">Notes (optional)</Label>
            <Textarea
              id="payment-notes"
              rows={1}
              value={state.paymentNotes}
              onChange={(e) => setPaymentNotes(e.currentTarget.value)}
              placeholder="Cash exchanged at front desk"
            />
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-foreground text-sm font-semibold tracking-tight">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
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
