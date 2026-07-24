"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ChevronDown, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition, type Dispatch, type SetStateAction } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  buildInitialEnrollmentState,
  deriveEnrollment,
  EnrollmentFields,
  type EnrollmentFieldsConfig,
  type EnrollmentFieldsState,
} from "@/components/forms/enrollment-fields";
import type { AddOn } from "@/lib/db/schema/add-ons";
import type { Member } from "@/lib/db/schema/members";
import type { Plan } from "@/lib/db/schema/plans";
import { memberGenders } from "@/lib/db/schema/members";
import { zodResolver } from "@/lib/forms/zod-resolver";
import { GENDER_LABELS } from "@/lib/constants/labels";
import { todayIstIso } from "@/lib/utils/dates";
import {
  formatPhoneForDisplay,
  normalizeIndianPhone,
} from "@/lib/utils/phone";
import { cn } from "@/lib/utils";
import { checkPhoneAvailable } from "@/server/actions/members/check-phone";
import { createMember } from "@/server/actions/members/create-member";
import { updateMember } from "@/server/actions/members/update-member";

const GENDER_NONE = "_unset" as const;

const formSchema = z.object({
  branchId: z.string().uuid("Choose a branch"),
  name: z.string().trim().min(2, "Use at least 2 characters").max(80),
  phone: z.string().trim().min(1, "Phone is required"),
  email: z.string().trim().max(120).optional().or(z.literal("")),
  gender: z.string().optional().or(z.literal("")),
  dob: z.string().optional().or(z.literal("")),
  joinedDate: z.string().min(1, "Pick a join date"),
  emergencyContactName: z.string().trim().max(80).optional().or(z.literal("")),
  emergencyContactPhone: z.string().trim().optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

type Branch = { id: string; name: string };

type MemberFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: Branch[];
  defaultBranchId: string;
  member: Member | null;
  showAddAnother?: boolean;
  /** When provided + creating a new member, expose the inline "Plan & payment" section. */
  enrollmentOptions?: {
    plans: Plan[];
    addOns: AddOn[];
  };
};

function defaults(
  member: Member | null,
  fallbackBranchId: string,
): FormValues {
  if (!member) {
    return {
      branchId: fallbackBranchId,
      name: "",
      phone: "",
      email: "",
      gender: GENDER_NONE,
      dob: "",
      joinedDate: todayIstIso(),
      emergencyContactName: "",
      emergencyContactPhone: "",
      address: "",
      notes: "",
    };
  }
  return {
    branchId: member.branchId,
    name: member.name,
    phone: member.phone,
    email: member.email ?? "",
    gender: member.gender ?? GENDER_NONE,
    dob: member.dob ?? "",
    joinedDate: member.joinedDate,
    emergencyContactName: member.emergencyContactName ?? "",
    emergencyContactPhone: member.emergencyContactPhone ?? "",
    address: member.address ?? "",
    notes: member.notes ?? "",
  };
}

export function MemberFormSheet({
  open,
  onOpenChange,
  branches,
  defaultBranchId,
  member,
  showAddAnother = true,
  enrollmentOptions,
}: MemberFormSheetProps) {
  const isEdit = member !== null;
  const canShowEnrollment = !isEdit && enrollmentOptions !== undefined;
  const [isPending, startTransition] = useTransition();
  const [addAnother, setAddAnother] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [enrollNow, setEnrollNow] = useState(canShowEnrollment);

  const enrollmentConfig = useMemo<EnrollmentFieldsConfig | null>(() => {
    if (!enrollmentOptions) return null;
    return {
      plans: enrollmentOptions.plans,
      addOns: enrollmentOptions.addOns,
      isFirstEnrollment: true,
    };
  }, [enrollmentOptions]);

  const [enrollState, setEnrollState] = useState<EnrollmentFieldsState | null>(
    () => (enrollmentConfig ? buildInitialEnrollmentState(enrollmentConfig) : null),
  );

  // Stable setState passed down to EnrollmentFields. Without this wrapper an
  // inline arrow function would change identity each render, the child's
  // useEffect would re-fire, and we'd loop infinitely.
  const setEnrollFieldsState = useCallback<
    Dispatch<SetStateAction<EnrollmentFieldsState>>
  >((updater) => {
    setEnrollState((prev) => {
      if (!prev) return prev;
      return typeof updater === "function"
        ? (updater as (s: EnrollmentFieldsState) => EnrollmentFieldsState)(prev)
        : updater;
    });
  }, []);

  useEffect(() => {
    if (!open || !canShowEnrollment || !enrollmentConfig) return;
    // Reset enrolment block when the sheet opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnrollNow(true);
    setEnrollState(buildInitialEnrollmentState(enrollmentConfig));
  }, [open, canShowEnrollment, enrollmentConfig]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaults(member, defaultBranchId),
  });

  useEffect(() => {
    if (!open) return;
    form.reset(defaults(member, defaultBranchId));
    // Sheet just opened — sync collapsible sections to whether the loaded
    // member already has data in those fields. This is the documented React
    // pattern for "adjust state when a prop changes" coordinated with form.reset.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEmergencyOpen(
      Boolean(member?.emergencyContactName || member?.emergencyContactPhone),
    );
    setExtrasOpen(Boolean(member?.address || member?.notes));
  }, [open, member, defaultBranchId, form]);

  const phoneRaw = useWatch({ control: form.control, name: "phone" });
  const normalisedPhone = normalizeIndianPhone(phoneRaw ?? "");

  const duplicateQuery = useQuery({
    queryKey: ["check-phone", normalisedPhone, member?.id ?? null],
    queryFn: () =>
      checkPhoneAvailable(normalisedPhone!, member?.id ?? undefined),
    enabled: open && !!normalisedPhone,
    staleTime: 5_000,
  });

  const duplicate =
    duplicateQuery.data && duplicateQuery.data.ok &&
    duplicateQuery.data.available === false
      ? duplicateQuery.data.existing
      : null;

  function onSubmit(values: FormValues) {
    form.clearErrors("root");
    if (duplicate) return;

    const memberPayload = {
      branchId: values.branchId,
      name: values.name,
      phone: values.phone,
      email: values.email?.trim() ? values.email.trim() : null,
      gender: values.gender && values.gender !== GENDER_NONE ? values.gender : null,
      dob: values.dob || null,
      joinedDate: values.joinedDate,
      emergencyContactName: values.emergencyContactName?.trim()
        ? values.emergencyContactName.trim()
        : null,
      emergencyContactPhone: values.emergencyContactPhone?.trim()
        ? values.emergencyContactPhone.trim()
        : null,
      address: values.address?.trim() ? values.address.trim() : null,
      notes: values.notes?.trim() ? values.notes.trim() : null,
    };

    let enrollmentPayload: Record<string, unknown> | undefined;
    if (canShowEnrollment && enrollNow && enrollState && enrollmentConfig) {
      const derived = deriveEnrollment(enrollState, enrollmentConfig);
      if (!derived.selectedPlan) {
        form.setError("root", { message: "Pick a plan to enrol." });
        return;
      }
      if (derived.discountTooLarge || derived.reasonMissing) {
        form.setError("root", {
          message: derived.reasonMissing
            ? "Discount needs a reason."
            : "Discount exceeds the total.",
        });
        return;
      }
      enrollmentPayload = {
        planId: enrollState.planId,
        appliedAddOnIds: [...enrollState.appliedAddOnIds],
        discountPaise: enrollState.discountPaise,
        discountReason:
          enrollState.discountPaise > 0
            ? enrollState.discountReason.trim()
            : null,
        finalAmountPaise: derived.finalAmount,
        paymentMode: enrollState.paymentMode,
        paymentDate: enrollState.paymentDate,
        paymentNotes: enrollState.paymentNotes.trim()
          ? enrollState.paymentNotes.trim()
          : null,
        startDate: derived.startDate,
      };
    }

    startTransition(async () => {
      const result = isEdit
        ? await updateMember(member.id, memberPayload)
        : await createMember({
            member: memberPayload,
            ...(enrollmentPayload ? { enrollment: enrollmentPayload } : {}),
          });

      if (!result.ok) {
        if (result.code === "duplicate_phone") {
          form.setError("phone", { message: result.error });
        } else if (result.code === "validation") {
          form.setError("root", { message: result.error });
        } else {
          form.setError("root", { message: result.error });
        }
        return;
      }
      const successMessage =
        result.ok && "invoiceNumber" in result && result.invoiceNumber
          ? `Member added · invoice ${result.invoiceNumber}`
          : isEdit
            ? "Member updated"
            : "Member added";
      toast.success(successMessage);

      if (!isEdit && addAnother) {
        const keepBranch = values.branchId;
        const keepJoined = values.joinedDate;
        const keepPaymentMode = enrollState?.paymentMode;
        form.reset({
          ...defaults(null, keepBranch),
          branchId: keepBranch,
          joinedDate: keepJoined,
        });
        setEmergencyOpen(false);
        setExtrasOpen(false);
        if (canShowEnrollment && enrollmentConfig) {
          setEnrollState({
            ...buildInitialEnrollmentState(enrollmentConfig),
            paymentMode: keepPaymentMode ?? "cash",
            paymentDate: todayIstIso(),
          });
        }
        // focus name input on next tick
        requestAnimationFrame(() => form.setFocus("name"));
        return;
      }
      onOpenChange(false);
    });
  }

  const submitError = form.formState.errors.root?.message;
  const phoneHint =
    normalisedPhone && !duplicate
      ? `Will be saved as ${formatPhoneForDisplay(normalisedPhone)}`
      : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit member" : "Add member"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Changes are audited."
              : "Quick details now; you can fill in the rest later."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pt-2 pb-4">
              <Section title="Personal details">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input
                          autoComplete="off"
                          placeholder="Rohit Sharma"
                          autoFocus
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone *</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel-national"
                          placeholder="98765 43210"
                          aria-invalid={!!duplicate}
                          {...field}
                        />
                      </FormControl>
                      {duplicate ? (
                        <div className="border-destructive/40 bg-destructive/5 mt-1.5 flex items-start gap-2 rounded-md border p-2.5 text-sm">
                          <AlertCircle className="text-destructive mt-0.5 size-4 shrink-0" />
                          <div className="flex-1 space-y-1">
                            <p className="text-destructive font-medium">
                              A member with this phone already exists.
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {duplicate.name} · {duplicate.branchName} ·
                              joined {duplicate.joinedDate}
                            </p>
                            <Link
                              href={`/app/members/${duplicate.id}`}
                              className="text-primary text-xs font-medium hover:underline"
                              onClick={() => onOpenChange(false)}
                            >
                              View member →
                            </Link>
                          </div>
                        </div>
                      ) : phoneHint ? (
                        <p className="text-muted-foreground text-xs">{phoneHint}</p>
                      ) : null}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gender</FormLabel>
                        <Select
                          value={field.value || GENDER_NONE}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={GENDER_NONE}>
                              Not specified
                            </SelectItem>
                            {memberGenders.map((g) => (
                              <SelectItem key={g} value={g}>
                                {GENDER_LABELS[g]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dob"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date of birth</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          autoComplete="off"
                          placeholder="rohit@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Section>

              <Section title="Branch & membership">
                <FormField
                  control={form.control}
                  name="branchId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Branch *</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={branches.length <= 1 && !isEdit}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {branches.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="joinedDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Joined date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Section>

              {canShowEnrollment && enrollmentConfig && enrollState ? (
                <section className="space-y-3">
                  <div className="bg-muted/30 flex items-start justify-between gap-3 rounded-md border p-3">
                    <div className="space-y-0.5">
                      <label
                        htmlFor="enrol-now-toggle"
                        className="text-foreground text-sm font-semibold cursor-pointer"
                      >
                        Plan & payment
                      </label>
                      <p className="text-muted-foreground text-xs">
                        {enrollNow
                          ? "Enrol this member in a plan now."
                          : "Skip if just registering — enrol later from the member detail page."}
                      </p>
                    </div>
                    <Switch
                      id="enrol-now-toggle"
                      checked={enrollNow}
                      onCheckedChange={(v) => setEnrollNow(v === true)}
                    />
                  </div>
                  {enrollNow ? (
                    <EnrollmentFields
                      config={enrollmentConfig}
                      state={enrollState}
                      setState={setEnrollFieldsState}
                    />
                  ) : null}
                </section>
              ) : null}

              <Collapsible
                title="Emergency contact"
                open={emergencyOpen}
                onToggle={setEmergencyOpen}
              >
                <FormField
                  control={form.control}
                  name="emergencyContactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input autoComplete="off" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="emergencyContactPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          inputMode="tel"
                          autoComplete="off"
                          placeholder="98765 43210"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Collapsible>

              <Collapsible
                title="Address & notes"
                open={extrasOpen}
                onToggle={setExtrasOpen}
              >
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Collapsible>

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
                {showAddAnother && !isEdit ? (
                  <label className="flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={addAnother}
                      onCheckedChange={(v) => setAddAnother(v === true)}
                    />
                    <span>Add another after this</span>
                  </label>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-2">
                  <SheetClose asChild>
                    <Button type="button" variant="outline" disabled={isPending}>
                      Cancel
                    </Button>
                  </SheetClose>
                  <Button
                    type="submit"
                    disabled={isPending || !!duplicate}
                  >
                    {isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : isEdit ? (
                      "Save changes"
                    ) : canShowEnrollment && enrollNow ? (
                      "Add member & enrol"
                    ) : (
                      "Add member"
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

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h3 className="text-foreground text-sm font-semibold tracking-tight">
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Collapsible({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: (next: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <button
        type="button"
        onClick={() => onToggle(!open)}
        className="hover:bg-muted/50 flex w-full items-center justify-between rounded-md px-2 py-1.5 -mx-2 text-sm font-semibold tracking-tight"
      >
        <span>{title}</span>
        <ChevronDown
          className={cn(
            "size-4 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? <div className="space-y-4">{children}</div> : null}
    </section>
  );
}
