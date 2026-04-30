"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type BranchOption = { id: string; name: string };

type BranchSelectorProps = {
  branches: BranchOption[];
  activeBranchId: string | null;
};

export function BranchSelector({ branches, activeBranchId }: BranchSelectorProps) {
  const active =
    branches.find((b) => b.id === activeBranchId) ?? branches[0] ?? null;
  const label = active?.name ?? "No branch";

  if (branches.length <= 1) {
    return (
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <span className="bg-muted-foreground/40 size-1.5 rounded-full" />
        <span className="text-foreground/80 font-medium">{label}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="text-foreground/80 hover:bg-accent flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-medium transition-colors">
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
        {branches.map((b) => (
          <DropdownMenuItem key={b.id} className="justify-between">
            <span>{b.name}</span>
            {b.id === active?.id ? <Check className="size-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
