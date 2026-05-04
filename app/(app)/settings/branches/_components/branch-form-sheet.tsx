"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
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
  createBranchAction,
  updateBranchAction,
} from "@/server/actions/settings/branch-actions";

type Branch = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch: Branch | null;
};

export function BranchFormSheet({ open, onOpenChange, branch }: Props) {
  const isEdit = branch !== null;
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(branch?.name ?? "");
    setAddress(branch?.address ?? "");
    setPhone(branch?.phone ?? "");
  }, [open, branch]);

  function submit() {
    startTransition(async () => {
      const result = isEdit
        ? await updateBranchAction({
            branchId: branch.id,
            name,
            address,
            phone,
          })
        : await createBranchAction({ name, address, phone });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? "Branch updated" : "Branch added");
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit branch" : "Add branch"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Rename or update the contact details for this branch."
              : "New branches show up immediately in member, plan, and payment workflows."}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pt-2 pb-4">
          <div className="space-y-1.5">
            <Label htmlFor="branch-name">Branch name *</Label>
            <Input
              id="branch-name"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              maxLength={60}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="branch-address">Address</Label>
            <Textarea
              id="branch-address"
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.currentTarget.value)}
              maxLength={500}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="branch-phone">Phone</Label>
            <Input
              id="branch-phone"
              value={phone}
              onChange={(e) => setPhone(e.currentTarget.value)}
              placeholder="Optional, e.g. 9876543210"
            />
            <p className="text-muted-foreground text-xs">
              Saved as +91 XXXXX XXXXX.
            </p>
          </div>
        </div>
        <SheetFooter className="border-t">
          <div className="flex w-full items-center justify-end gap-2">
            <SheetClose asChild>
              <Button type="button" variant="outline" className="w-fit">
                Cancel
              </Button>
            </SheetClose>
            <Button
              type="button"
              onClick={submit}
              disabled={isPending || name.trim().length < 2}
              className="w-fit"
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : isEdit ? (
                "Save changes"
              ) : (
                "Add branch"
              )}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
