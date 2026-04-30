"use client";

import { Loader2, Power, PowerOff } from "lucide-react";
import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
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
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MoneyInput } from "@/components/shared/money-input";
import type { AddOn } from "@/lib/db/schema/add-ons";
import { addOnTypes } from "@/lib/db/schema/add-ons";
import { zodResolver } from "@/lib/forms/zod-resolver";
import { createAddOn } from "@/server/actions/add-ons/create-add-on";
import { toggleAddOnActive } from "@/server/actions/add-ons/toggle-add-on-active";
import { updateAddOn } from "@/server/actions/add-ons/update-add-on";

const formSchema = z.object({
  name: z.string().trim().min(2, "At least 2 characters").max(60),
  amountPaise: z.number().int().min(0, "Cannot be negative"),
  type: z.enum(addOnTypes),
  autoApplyOnFirstEnrollment: z.boolean(),
  description: z.string().trim().max(140).optional(),
});

type FormValues = z.infer<typeof formSchema>;

const DEFAULT_VALUES: FormValues = {
  name: "",
  amountPaise: 0,
  type: "one_time",
  autoApplyOnFirstEnrollment: false,
  description: "",
};

type AddOnFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addOn: AddOn | null;
};

export function AddOnFormSheet({ open, onOpenChange, addOn }: AddOnFormSheetProps) {
  const isEdit = addOn !== null;
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (!open) return;
    if (addOn) {
      form.reset({
        name: addOn.name,
        amountPaise: addOn.amountPaise,
        type: addOn.type,
        autoApplyOnFirstEnrollment: addOn.autoApplyOnFirstEnrollment,
        description: addOn.description ?? "",
      });
    } else {
      form.reset(DEFAULT_VALUES);
    }
  }, [open, addOn, form]);

  const submitError = form.formState.errors.root?.message;

  function onSubmit(values: FormValues) {
    form.clearErrors("root");
    const payload = {
      ...values,
      description: values.description?.trim() ? values.description : null,
    };

    startTransition(async () => {
      const result = isEdit
        ? await updateAddOn(addOn.id, payload)
        : await createAddOn(payload);

      if (!result.ok) {
        if (result.code === "duplicate_name") {
          form.setError("name", { message: result.error });
        } else {
          form.setError("root", { message: result.error });
        }
        return;
      }
      toast.success(isEdit ? "Add-on updated" : "Add-on created");
      onOpenChange(false);
    });
  }

  function handleToggleActive() {
    if (!addOn) return;
    startTransition(async () => {
      const result = await toggleAddOnActive(addOn.id, !addOn.isActive);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(addOn.isActive ? "Add-on deactivated" : "Add-on reactivated");
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit add-on" : "Add add-on"}</SheetTitle>
          <SheetDescription>
            Add-ons appear at enrollment time alongside the chosen plan.
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pt-2 pb-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Registration Fee"
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
                name="amountPaise"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
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
                        <ToggleGroupItem value="one_time" className="flex-1">
                          One-time
                        </ToggleGroupItem>
                        <ToggleGroupItem value="recurring" className="flex-1">
                          Recurring
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="autoApplyOnFirstEnrollment"
                render={({ field }) => (
                  <FormItem className="bg-muted/30 flex flex-row items-start gap-3 rounded-md border p-3">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm">
                        Auto-apply on first enrollment
                      </FormLabel>
                      <FormDescription className="text-xs">
                        When ON, this add-on is pre-checked when enrolling a new
                        member.
                      </FormDescription>
                    </div>
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
                          maxLength={140}
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormDescription>{length}/140</FormDescription>
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
                        {addOn.isActive ? (
                          <>
                            <PowerOff className="size-3.5" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <Power className="size-3.5" />
                            Reactivate
                          </>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {addOn.isActive ? "Deactivate" : "Reactivate"} this
                          add-on?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {addOn.isActive
                            ? "It will no longer be selectable at enrollment."
                            : "It will be selectable at enrollment again."}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleToggleActive}>
                          {addOn.isActive ? "Deactivate" : "Reactivate"}
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
                      "Save add-on"
                    ) : (
                      "Create add-on"
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
