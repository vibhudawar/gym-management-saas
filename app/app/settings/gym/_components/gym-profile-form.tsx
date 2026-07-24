"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  GSTIN_PATTERN,
  INVOICE_PREFIX_PATTERN,
} from "@/lib/constants/validation";
import { updateGymProfile } from "@/server/actions/settings/update-gym-profile";

type Props = {
  initial: {
    name: string;
    gstNumber: string | null;
    invoicePrefix: string;
    subscriptionTier: "basic" | "pro";
    currency: string;
    createdAt: Date;
  };
};

export function GymProfileForm({ initial }: Props) {
  const [name, setName] = useState(initial.name);
  const [gst, setGst] = useState(initial.gstNumber ?? "");
  const [prefix, setPrefix] = useState(initial.invoicePrefix);
  const [confirmDialog, setConfirmDialog] = useState<{
    existingInvoiceCount: number;
  } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (name.trim().length < 2 || name.trim().length > 80) {
      next.name = "Name must be 2–80 characters.";
    }
    if (!INVOICE_PREFIX_PATTERN.test(prefix.trim())) {
      next.prefix = "Use 2–10 uppercase letters, digits, or hyphens.";
    }
    if (gst.trim() && !GSTIN_PATTERN.test(gst.trim().toUpperCase())) {
      next.gst = "Enter a valid 15-character GSTIN.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function submit(acknowledgePrefixChange = false) {
    if (!validate()) return;
    startTransition(async () => {
      const result = await updateGymProfile({
        name: name.trim(),
        gstNumber: gst.trim() ? gst.trim().toUpperCase() : null,
        invoicePrefix: prefix.trim().toUpperCase(),
        acknowledgeInvoicePrefixChange: acknowledgePrefixChange,
      });
      if (!result.ok) {
        if (result.code === "INVOICE_PREFIX_CONFIRM" && result.existingInvoiceCount) {
          setConfirmDialog({ existingInvoiceCount: result.existingInvoiceCount });
          return;
        }
        toast.error(result.error);
        return;
      }
      setConfirmDialog(null);
      toast.success("Gym profile updated.");
    });
  }

  return (
    <>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit(false);
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="gym-name">Gym name *</Label>
          <Input
            id="gym-name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            maxLength={80}
          />
          {errors.name ? (
            <p className="text-destructive text-xs">{errors.name}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="invoice-prefix">Invoice prefix *</Label>
          <Input
            id="invoice-prefix"
            value={prefix}
            onChange={(e) => setPrefix(e.currentTarget.value.toUpperCase())}
            maxLength={10}
            className="font-mono uppercase"
          />
          <p className="text-muted-foreground text-xs">
            New invoices will start with this prefix.
          </p>
          {errors.prefix ? (
            <p className="text-destructive text-xs">{errors.prefix}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="gst-number">GST number</Label>
          <Input
            id="gst-number"
            value={gst}
            onChange={(e) => setGst(e.currentTarget.value.toUpperCase())}
            maxLength={15}
            className="font-mono uppercase"
            placeholder="27ABCDE1234F1Z5"
          />
          <p className="text-muted-foreground text-xs">
            Optional. Set this if you charge GST on invoices.
          </p>
          {errors.gst ? (
            <p className="text-destructive text-xs">{errors.gst}</p>
          ) : null}
        </div>

        <div className="border-border/50 grid grid-cols-2 gap-4 border-t pt-4 text-xs">
          <div>
            <p className="text-muted-foreground">Plan</p>
            <p className="text-foreground capitalize">{initial.subscriptionTier}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Created</p>
            <p className="text-foreground">
              {initial.createdAt.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Currency</p>
            <p className="text-foreground">{initial.currency}</p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => {
              setName(initial.name);
              setGst(initial.gstNumber ?? "");
              setPrefix(initial.invoicePrefix);
              setErrors({});
            }}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : "Save changes"}
          </Button>
        </div>
      </form>

      <AlertDialog
        open={confirmDialog !== null}
        onOpenChange={(o) => !o && setConfirmDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change invoice prefix?</AlertDialogTitle>
            <AlertDialogDescription>
              You have{" "}
              {confirmDialog?.existingInvoiceCount.toLocaleString("en-IN")}{" "}
              existing invoice{confirmDialog?.existingInvoiceCount === 1 ? "" : "s"}{" "}
              with the prefix <span className="font-mono">{initial.invoicePrefix}</span>.
              They keep their current prefix. New invoices will use{" "}
              <span className="font-mono">{prefix}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="w-fit">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => submit(true)} className="w-fit">
              Save with new prefix
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
