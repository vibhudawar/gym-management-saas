"use client";

import { Loader2, Play } from "lucide-react";
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
import {
  addDaysIso,
  daysBetweenInclusiveIso,
  formatCalendarDate,
  todayIstIso,
} from "@/lib/utils/dates";
import { unfreezeEarlyAction } from "@/server/actions/freezes/unfreeze-early";

const MIN_REASON = 10;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  memberName: string;
  planName: string;
  freeze: {
    id: string;
    freezeStartDate: string;
    freezeEndDate: string;
    daysAdded: number;
  };
  membershipEndDate: string;
};

export function UnfreezeSheet({
  open,
  onOpenChange,
  memberId,
  memberName,
  planName,
  freeze,
  membershipEndDate,
}: Props) {
  const today = todayIstIso();
  const [unfreezeDate, setUnfreezeDate] = useState<string>(today);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUnfreezeDate(today);
    setReason("");
    setError(null);
  }, [open, freeze.id, today]);

  const actualEndDate = useMemo(() => addDaysIso(unfreezeDate, -1), [unfreezeDate]);
  const daysUsed = useMemo(() => {
    if (actualEndDate < freeze.freezeStartDate) return 0;
    return daysBetweenInclusiveIso(freeze.freezeStartDate, actualEndDate);
  }, [actualEndDate, freeze.freezeStartDate]);
  const daysSaved = Math.max(0, freeze.daysAdded - daysUsed);
  const newEndDate = useMemo(
    () => addDaysIso(membershipEndDate, -daysSaved),
    [membershipEndDate, daysSaved],
  );

  const dateError = (() => {
    if (unfreezeDate < today) return "Cannot unfreeze in the past.";
    if (unfreezeDate < freeze.freezeStartDate)
      return "Cannot unfreeze before the freeze starts.";
    if (unfreezeDate > freeze.freezeEndDate)
      return "Use the natural end — this freeze is already past its end date.";
    return null;
  })();

  const reasonValid = reason.trim().length >= MIN_REASON;
  const canSubmit = !dateError && reasonValid && !isPending;

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await unfreezeEarlyAction({
        freezeId: freeze.id,
        unfreezeDate,
        earlyUnfreezeReason: reason.trim(),
        memberId,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success(
        `Membership unfrozen. Active until ${formatCalendarDate(result.newMembershipEndDate)}.`,
      );
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Unfreeze membership</SheetTitle>
          <SheetDescription>
            Subtract unused days from the membership&apos;s end date.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pt-2 pb-4">
          <div className="bg-muted/30 space-y-1 rounded-md border p-3 text-sm">
            <p className="text-foreground font-medium">
              {memberName} · {planName}
            </p>
            <p className="text-muted-foreground text-xs">
              Frozen: {formatCalendarDate(freeze.freezeStartDate)} →{" "}
              {formatCalendarDate(freeze.freezeEndDate)} ({freeze.daysAdded} days)
            </p>
            <p className="text-muted-foreground text-xs">
              Currently ends: {formatCalendarDate(membershipEndDate)}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="unfreeze-date">Unfreeze date *</Label>
            <Input
              id="unfreeze-date"
              type="date"
              min={today < freeze.freezeStartDate ? freeze.freezeStartDate : today}
              max={freeze.freezeEndDate}
              value={unfreezeDate}
              onChange={(e) => setUnfreezeDate(e.currentTarget.value)}
            />
            {dateError ? (
              <p className="text-destructive text-xs">{dateError}</p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Days used so far:{" "}
                <span className="text-foreground font-medium">{daysUsed}</span> ·
                Days saved:{" "}
                <span className="text-foreground font-medium">{daysSaved}</span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="unfreeze-reason">Reason for early unfreeze *</Label>
            <Textarea
              id="unfreeze-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.currentTarget.value)}
              placeholder="Recovered early, joined back, etc."
            />
            <p className="text-muted-foreground text-xs">
              {reason.trim().length}/{MIN_REASON} minimum
            </p>
          </div>

          {!dateError ? (
            <div className="bg-muted/30 space-y-1 rounded-md border p-3 text-xs">
              <p className="text-foreground">
                Membership resumes{" "}
                <span className="font-medium">
                  {formatCalendarDate(unfreezeDate)}
                </span>
                .
              </p>
              <p className="text-muted-foreground">
                New end date:{" "}
                <span className="text-foreground font-medium">
                  {formatCalendarDate(newEndDate)}
                </span>{" "}
                (was {formatCalendarDate(membershipEndDate)}).
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
                      <Play className="size-4" />
                      Unfreeze now
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Unfreeze {memberName}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {daysSaved} day{daysSaved === 1 ? "" : "s"} will be returned to
                    the membership. New end date:{" "}
                    {formatCalendarDate(newEndDate)} (was{" "}
                    {formatCalendarDate(membershipEndDate)}).
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="w-fit">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={submit} className="w-fit">
                    Unfreeze
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
