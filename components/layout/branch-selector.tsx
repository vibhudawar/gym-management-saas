"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setActiveBranch } from "@/server/actions/branches/set-active-branch";

type BranchOption = { id: string; name: string };

type BranchSelectorProps = {
  branches: BranchOption[];
  activeBranchId: string | null;
  canSwitchAll: boolean;
};

export function BranchSelector({
  branches,
  activeBranchId,
  canSwitchAll,
}: BranchSelectorProps) {
  const [isPending, startTransition] = useTransition();

  const active = activeBranchId
    ? (branches.find((b) => b.id === activeBranchId) ?? null)
    : null;

  const label = active?.name ?? (canSwitchAll ? "All branches" : (branches[0]?.name ?? "No branch"));

  if (!canSwitchAll && branches.length <= 1) {
    return (
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <span className="bg-muted-foreground/40 size-1.5 rounded-full" />
        <span className="text-foreground/80 font-medium">{label}</span>
      </div>
    );
  }

  const handleSelect = (branchId: string | null) => {
    startTransition(async () => {
      const res = await setActiveBranch({ branchId });
      if (!res.ok) {
        toast.error(res.error);
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        className="text-foreground/80 hover:bg-accent flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-60"
      >
        <span className="flex items-center gap-1.5">
          <span className="bg-primary/60 size-1.5 rounded-full" />
          {label}
        </span>
        <ChevronsUpDown className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-muted-foreground text-xs">
          Switch branch
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {canSwitchAll ? (
          <DropdownMenuItem
            className="justify-between"
            onSelect={() => handleSelect(null)}
          >
            <span>All branches</span>
            {active === null ? <Check className="size-4" /> : null}
          </DropdownMenuItem>
        ) : null}
        {branches.map((b) => (
          <DropdownMenuItem
            key={b.id}
            className="justify-between"
            onSelect={() => handleSelect(b.id)}
          >
            <span>{b.name}</span>
            {b.id === active?.id ? <Check className="size-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
