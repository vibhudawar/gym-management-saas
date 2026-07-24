"use client";

import { MoreHorizontal, Pencil, PowerOff, Power, Loader2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Plan, PlanType } from "@/lib/db/schema/plans";
import { formatMoney } from "@/lib/utils/money";
import { togglePlanActive } from "@/server/actions/plans/toggle-plan-active";

const PLAN_TYPE_LABEL: Record<PlanType, string> = {
  general: "General",
  cardio: "Cardio",
  gym_cardio: "Gym + Cardio",
  custom: "Custom",
};

type PlanCardProps = {
  plan: Plan;
  canEdit: boolean;
  onEdit: (plan: Plan) => void;
};

export function PlanCard({ plan, canEdit, onEdit }: PlanCardProps) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await togglePlanActive(plan.id, !plan.isActive);
      if (!result.ok) {
        toast.error(result.error);
      } else {
        toast.success(plan.isActive ? "Plan deactivated" : "Plan reactivated");
      }
    });
  }

  return (
    <div className="bg-card flex flex-col rounded-xl border p-5 transition hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-base font-medium">
            {plan.name}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {plan.durationDays} days · {PLAN_TYPE_LABEL[plan.type]}
          </p>
        </div>
        {!plan.isActive ? (
          <Badge variant="secondary" className="shrink-0 text-xs">
            Inactive
          </Badge>
        ) : null}
      </div>

      <p className="text-foreground mt-4 text-2xl font-semibold tracking-tight">
        {formatMoney(plan.defaultPricePaise)}
      </p>

      {plan.description ? (
        <p className="text-muted-foreground mt-3 line-clamp-2 text-sm">
          {plan.description}
        </p>
      ) : null}

      {canEdit ? (
        <div className="mt-5 flex items-center justify-between border-t pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(plan)}
            className="-ml-2"
          >
            <Pencil className="size-3.5" />
            Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Plan actions"
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MoreHorizontal className="size-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {plan.isActive ? (
                <DropdownMenuItem onClick={handleToggle}>
                  <PowerOff className="size-4" />
                  Deactivate
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={handleToggle}>
                  <Power className="size-4" />
                  Reactivate
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
    </div>
  );
}
