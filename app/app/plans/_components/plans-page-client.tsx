"use client";

import { Package, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import type { AddOn } from "@/lib/db/schema/add-ons";
import type { Plan } from "@/lib/db/schema/plans";
import { AddOnFormSheet } from "./add-on-form-sheet";
import { AddOnsTable } from "./add-ons-table";
import { PlanCard } from "./plan-card";
import { PlanFormSheet } from "./plan-form-sheet";

type PlansPageClientProps = {
  plans: Plan[];
  addOns: AddOn[];
  canEdit: boolean;
};

export function PlansPageClient({
  plans,
  addOns,
  canEdit,
}: PlansPageClientProps) {
  const [tab, setTab] = useState<"plans" | "addons">("plans");

  const [planSheet, setPlanSheet] = useState<{ open: boolean; plan: Plan | null }>(
    { open: false, plan: null },
  );
  const [addOnSheet, setAddOnSheet] = useState<{
    open: boolean;
    addOn: AddOn | null;
  }>({ open: false, addOn: null });

  const activePlans = plans.filter((p) => p.isActive);
  const inactivePlans = plans.filter((p) => !p.isActive);

  function openCreatePlan() {
    setPlanSheet({ open: true, plan: null });
  }
  function openEditPlan(plan: Plan) {
    setPlanSheet({ open: true, plan });
  }
  function openCreateAddOn() {
    setAddOnSheet({ open: true, addOn: null });
  }
  function openEditAddOn(addOn: AddOn) {
    setAddOnSheet({ open: true, addOn });
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="Plans"
        description="Membership offerings shown at enrollment."
        actions={
          canEdit ? (
            tab === "plans" ? (
              <Button onClick={openCreatePlan}>
                <Plus className="size-4" />
                Add plan
              </Button>
            ) : (
              <Button onClick={openCreateAddOn}>
                <Plus className="size-4" />
                Add add-on
              </Button>
            )
          ) : undefined
        }
      />

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "plans" | "addons")}
        className="mt-2"
      >
        <TabsList>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="addons">Add-ons</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="mt-6">
          {plans.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No plans yet"
              description="Create your first membership plan to start enrolling members."
              action={
                canEdit ? (
                  <Button onClick={openCreatePlan}>
                    <Plus className="size-4" />
                    Add your first plan
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <Tabs defaultValue="active">
              <TabsList>
                <TabsTrigger value="active">
                  Active{" "}
                  <span className="text-muted-foreground ml-1.5 tabular-nums">
                    {activePlans.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="inactive">
                  Inactive{" "}
                  <span className="text-muted-foreground ml-1.5 tabular-nums">
                    {inactivePlans.length}
                  </span>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="active" className="mt-4">
                <PlansGrid
                  plans={activePlans}
                  canEdit={canEdit}
                  onEdit={openEditPlan}
                  emptyLabel="No active plans. Reactivate one from the Inactive tab."
                />
              </TabsContent>
              <TabsContent value="inactive" className="mt-4">
                <PlansGrid
                  plans={inactivePlans}
                  canEdit={canEdit}
                  onEdit={openEditPlan}
                  emptyLabel="No inactive plans."
                />
              </TabsContent>
            </Tabs>
          )}
        </TabsContent>

        <TabsContent value="addons" className="mt-6">
          {addOns.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No add-ons yet"
              description="Add charges like Registration Fee or Locker rent."
              action={
                canEdit ? (
                  <Button onClick={openCreateAddOn}>
                    <Plus className="size-4" />
                    Add your first add-on
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <AddOnsTable addOns={addOns} canEdit={canEdit} onEdit={openEditAddOn} />
          )}
        </TabsContent>
      </Tabs>

      <PlanFormSheet
        open={planSheet.open}
        onOpenChange={(open) =>
          setPlanSheet((s) => ({ open, plan: open ? s.plan : null }))
        }
        plan={planSheet.plan}
      />
      <AddOnFormSheet
        open={addOnSheet.open}
        onOpenChange={(open) =>
          setAddOnSheet((s) => ({ open, addOn: open ? s.addOn : null }))
        }
        addOn={addOnSheet.addOn}
      />
    </div>
  );
}

type PlansGridProps = {
  plans: Plan[];
  canEdit: boolean;
  onEdit: (plan: Plan) => void;
  emptyLabel: string;
};

function PlansGrid({ plans, canEdit, onEdit, emptyLabel }: PlansGridProps) {
  if (plans.length === 0) {
    return (
      <p className="text-muted-foreground bg-card/50 rounded-xl border border-dashed px-4 py-8 text-center text-sm">
        {emptyLabel}
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          canEdit={canEdit}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}
