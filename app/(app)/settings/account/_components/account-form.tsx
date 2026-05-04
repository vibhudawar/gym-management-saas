"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABEL, type Role } from "@/lib/auth/roles";
import { updateAccount } from "@/server/actions/settings/update-account";

type Props = {
  initial: {
    name: string;
    phone: string | null;
    email: string;
    role: Role;
    branchName: string | null;
  };
};

export function AccountForm({ initial }: Props) {
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await updateAccount({ name: name.trim(), phone: phone.trim() });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Profile updated.");
    });
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="account-name">Name</Label>
        <Input
          id="account-name"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          maxLength={80}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="account-phone">Phone</Label>
        <Input
          id="account-phone"
          value={phone}
          onChange={(e) => setPhone(e.currentTarget.value)}
          placeholder="+91 9876543210"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input value={initial.email} disabled className="bg-muted/40" />
        <p className="text-muted-foreground text-xs">
          Email is your login identity and cannot be changed.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Role</Label>
          <Input value={ROLE_LABEL[initial.role]} disabled className="bg-muted/40" />
        </div>
        <div className="space-y-1.5">
          <Label>Branch</Label>
          <Input
            value={initial.branchName ?? "All branches"}
            disabled
            className="bg-muted/40"
          />
        </div>
      </div>
      {error ? (
        <p
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm"
        >
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => {
            setName(initial.name);
            setPhone(initial.phone ?? "");
            setError(null);
          }}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
