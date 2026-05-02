"use client";

import { Loader2, Pause } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
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
import { formatCalendarDate } from "@/lib/utils/dates";
import { createFreezeAction } from "@/server/actions/freezes/create-freeze";

const MIN_REASON = 10;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  membershipId: string;
  memberName: string;
  planName: string;
  membershipEndDate: string; // YYYY-MM-DD
  pastFreezeCount: number;
};

function todayIso(): string {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  )
    .toISOString()
    .slice(0, 10);
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetweenInclusive(startIso: string, endIso: string): number {
  if (endIso < startIso) return 0;
  const s = new Date(`${startIso}T00:00:00Z`);
  const e = new Date(`${endIso}T00:00:00Z`);
  return Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
}

export function FreezeSheet({
  open,
  onOpenChange,
  memberId,
  membershipId,
  memberName,
  planName,
  membershipEndDate,
  pastFreezeCount,
}: Props) {
  const [startDate, setStartDate] = useState<string>(todayIso());
  const [endDate, setEndDate] = useState<string>(addDaysIso(todayIso(), 13));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStartDate(todayIso());
    setEndDate(addDaysIso(todayIso(), 13));
    setReason("");
    setError(null);
  }, [open, membershipId]);

  const today = todayIso();
  const duration = useMemo(
    () => daysBetweenInclusive(startDate, endDate),
    [startDate, endDate],
  );
  const projectedEnd = useMemo(
    () => (duration > 0 ? addDaysIso(membershipEndDate, duration) : membershipEndDate),
    [membershipEndDate, duration],
  );
  const resumeDate = useMemo(() => addDaysIso(endDate, 1), [endDate]);

  const dateError = (() => {
    if (startDate < today) return "Start date cannot be in the past.";
    if (endDate < startDate) return "End date cannot be before start date.";
    if (startDate >= membershipEndDate)
      return "Freeze cannot start at or after the membership ends.";
    return null;
  })();

  const reasonValid = reason.trim().length >= MIN_REASON;
  const canSubmit = !dateError && reasonValid && !isPending;

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createFreezeAction({
        membershipId,
        freezeStartDate: startDate,
        freezeEndDate: endDate,
        reason: reason.trim(),
        memberId,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success(
        `Membership frozen. Resumes ${formatCalendarDate(resumeDate)}.`,
      );
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Freeze membership</SheetTitle>
          <SheetDescription>
            Pause days will extend the end date by exactly the same amount.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pt-2 pb-4">
          <div className="bg-muted/30 space-y-1 rounded-md border p-3 text-sm">
            <p className="text-foreground font-medium">
              {memberName} · {planName}
            </p>
            <p className="text-muted-foreground text-xs">
              Currently ends: {formatCalendarDate(membershipEndDate)}
            </p>
            <p className="text-muted-foreground text-xs">
              Past freezes on this membership: {pastFreezeCount}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="freeze-start">Start date *</Label>
              <Input
                id="freeze-start"
                type="date"
                min={today}
                max={membershipEndDate}
                value={startDate}
                onChange={(e) => setStartDate(e.currentTarget.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="freeze-end">End date *</Label>
              <Input
                id="freeze-end"
                type="date"
                min={startDate}
                value={endDate}
                onChange={(e) => setEndDate(e.currentTarget.value)}
              />
            </div>
          </div>

          {duration > 0 ? (
            <p className="text-muted-foreground text-xs">
              Duration: <span className="text-foreground font-medium">{duration} days</span>
            </p>
          ) : null}

          {dateError ? (
            <p className="text-destructive text-xs">{dateError}</p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="freeze-reason">Reason *</Label>
            <Textarea
              id="freeze-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.currentTarget.value)}
              placeholder="Vacation, illness, injury, etc."
            />
            <p className="text-muted-foreground text-xs">
              {reason.trim().length}/{MIN_REASON} minimum
            </p>
          </div>

          {duration > 0 && !dateError ? (
            <div className="bg-muted/30 space-y-1 rounded-md border p-3 text-xs">
              <p className="text-foreground">
                Membership will resume{" "}
                <span className="font-medium">
                  {formatCalendarDate(resumeDate)}
                </span>
                .
              </p>
              <p className="text-muted-foreground">
                New end date:{" "}
                <span className="text-foreground font-medium">
                  {formatCalendarDate(projectedEnd)}
                </span>
                .
              </p>
            </div>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm"
            >
              {error}
            </p>
          ) : null}
        </div>

        <SheetFooter className="border-t">
          <div className="flex w-full items-center justify-end gap-2">
            <SheetClose asChild>
              <Button type="button" variant="outline" disabled={isPending} className="w-fit">
                Cancel
              </Button>
            </SheetClose>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={!canSubmit} className="w-fit">
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <Pause className="size-4" />
                      Freeze membership
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm freeze</AlertDialogTitle>
                  <AlertDialogDescription>
                    Freeze {memberName}&rsquo;s {planName} membership for {duration} days?
                    End date will move from {formatCalendarDate(membershipEndDate)}{" "}
                    to {formatCalendarDate(projectedEnd)}.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="w-fit">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={submit} className="w-fit">
                    Freeze
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
