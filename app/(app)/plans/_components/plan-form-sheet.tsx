"use client";

import { Loader2, PowerOff, Power } from "lucide-react";
import { useEffect, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MoneyInput } from "@/components/shared/money-input";
import type { Plan } from "@/lib/db/schema/plans";
import { planTypes } from "@/lib/db/schema/plans";
import { zodResolver } from "@/lib/forms/zod-resolver";
import { createPlan } from "@/server/actions/plans/create-plan";
import { togglePlanActive } from "@/server/actions/plans/toggle-plan-active";
import { updatePlan } from "@/server/actions/plans/update-plan";

const PLAN_TYPE_LABELS: Record<(typeof planTypes)[number], string> = {
  general: "General",
  cardio: "Cardio",
  gym_cardio: "Gym + Cardio",
  custom: "Custom",
};

const formSchema = z.object({
  name: z.string().trim().min(2, "At least 2 characters").max(80),
  type: z.enum(planTypes),
  durationValue: z.number().int().min(1, "Must be at least 1"),
  durationUnit: z.enum(["days", "months"]),
  defaultPricePaise: z.number().int().min(0, "Cannot be negative"),
  description: z.string().trim().max(280).optional(),
});

type FormValues = z.infer<typeof formSchema>;

function decomposeDuration(days: number): {
  value: number;
  unit: "days" | "months";
} {
  if (days >= 30 && days % 30 === 0) return { value: days / 30, unit: "months" };
  return { value: days, unit: "days" };
}

const DEFAULT_VALUES: FormValues = {
  name: "",
  type: "general",
  durationValue: 3,
  durationUnit: "months",
  defaultPricePaise: 0,
  description: "",
};

type PlanFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: Plan | null;
};

export function PlanFormSheet({ open, onOpenChange, plan }: PlanFormSheetProps) {
  const isEdit = plan !== null;
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (!open) return;
    if (plan) {
      const d = decomposeDuration(plan.durationDays);
      form.reset({
        name: plan.name,
        type: plan.type,
        durationValue: d.value,
        durationUnit: d.unit,
        defaultPricePaise: plan.defaultPricePaise,
        description: plan.description ?? "",
      });
    } else {
      form.reset(DEFAULT_VALUES);
    }
  }, [open, plan, form]);

  const durationValue = useWatch({ control: form.control, name: "durationValue" });
  const durationUnit = useWatch({ control: form.control, name: "durationUnit" });
  const computedDays =
    durationUnit === "months" ? durationValue * 30 : durationValue;

  const submitError = form.formState.errors.root?.message;

  function onSubmit(values: FormValues) {
    form.clearErrors("root");
    const payload = {
      name: values.name,
      type: values.type,
      durationDays: computedDays,
      defaultPricePaise: values.defaultPricePaise,
      description: values.description?.trim() ? values.description : null,
    };

    startTransition(async () => {
      const result = isEdit
        ? await updatePlan(plan.id, payload)
        : await createPlan(payload);

      if (!result.ok) {
        if (result.code === "duplicate_name") {
          form.setError("name", { message: result.error });
        } else {
          form.setError("root", { message: result.error });
        }
        return;
      }
      toast.success(isEdit ? "Plan updated" : "Plan created");
      onOpenChange(false);
    });
  }

  function handleToggleActive() {
    if (!plan) return;
    startTransition(async () => {
      const result = await togglePlanActive(plan.id, !plan.isActive);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(plan.isActive ? "Plan deactivated" : "Plan reactivated");
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit plan" : "Add plan"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Changes are audited."
              : "Visible at every enrollment for your gym."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-1 flex-col"
          >
            <div className="flex-1 space-y-5 overflow-y-auto px-4 pt-2 pb-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="3 Months Gym + Cardio"
                        autoComplete="off"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <FormControl>
                      <ToggleGroup
                        type="single"
                        value={field.value}
                        onValueChange={(v) => v && field.onChange(v)}
                        variant="outline"
                        className="w-full"
                      >
                        {planTypes.map((t) => (
                          <ToggleGroupItem
                            key={t}
                            value={t}
                            aria-label={PLAN_TYPE_LABELS[t]}
                            className="flex-1 text-xs"
                          >
                            {PLAN_TYPE_LABELS[t]}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <Label htmlFor="duration-value">Duration</Label>
                <div className="flex gap-2">
                  <FormField
                    control={form.control}
                    name="durationValue"
                    render={({ field }) => (
                      <FormItem className="flex-1 space-y-0">
                        <FormControl>
                          <Input
                            id="duration-value"
                            type="number"
                            min={1}
                            inputMode="numeric"
                            value={field.value}
                            onChange={(e) =>
                              field.onChange(
                                Number.parseInt(e.currentTarget.value, 10) || 0,
                              )
                            }
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="durationUnit"
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormControl>
                          <ToggleGroup
                            type="single"
                            value={field.value}
                            onValueChange={(v) => v && field.onChange(v)}
                            variant="outline"
                          >
                            <ToggleGroupItem value="days">Days</ToggleGroupItem>
                            <ToggleGroupItem value="months">
                              Months
                            </ToggleGroupItem>
                          </ToggleGroup>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <p className="text-muted-foreground text-[0.8rem]">
                  = {computedDays} days
                </p>
                {form.formState.errors.durationValue ? (
                  <p className="text-destructive text-[0.8rem] font-medium">
                    {form.formState.errors.durationValue.message}
                  </p>
                ) : null}
              </div>

              <FormField
                control={form.control}
                name="defaultPricePaise"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>Price</FormLabel>
                    <FormControl>
                      <MoneyInput
                        value={field.value}
                        onChange={(paise) => field.onChange(paise ?? 0)}
                        ariaInvalid={!!fieldState.error}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => {
                  const length = (field.value ?? "").length;
                  return (
                    <FormItem>
                      <FormLabel>Description (optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          maxLength={280}
                          placeholder="What this plan includes…"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormDescription>{length}/280</FormDescription>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              {submitError ? (
                <p
                  role="alert"
                  className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm"
                >
                  {submitError}
                </p>
              ) : null}
            </div>

            <SheetFooter className="border-t">
              <div className="flex w-full items-center justify-between gap-2">
                {isEdit ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive -ml-2"
                        disabled={isPending}
                      >
                        {plan.isActive ? (
                          <>
                            <PowerOff className="size-3.5" />
                            Deactivate plan
                          </>
                        ) : (
                          <>
                            <Power className="size-3.5" />
                            Reactivate plan
                          </>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {plan.isActive ? "Deactivate" : "Reactivate"} this
                          plan?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {plan.isActive
                            ? "It will be hidden from new enrollments. Existing memberships are not affected."
                            : "It will appear in the new-enrollment picker again."}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleToggleActive}>
                          {plan.isActive ? "Deactivate" : "Reactivate"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-2">
                  <SheetClose asChild>
                    <Button type="button" variant="outline" disabled={isPending}>
                      Cancel
                    </Button>
                  </SheetClose>
                  <Button type="submit" disabled={isPending}>
                    {isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : isEdit ? (
                      "Save plan"
                    ) : (
                      "Create plan"
                    )}
                  </Button>
                </div>
              </div>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
