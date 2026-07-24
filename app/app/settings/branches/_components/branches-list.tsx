"use client";

import { MoreHorizontal, Plus, RotateCcw } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatPhoneForDisplay } from "@/lib/utils/phone";
import {
  deactivateBranchAction,
  reactivateBranchAction,
} from "@/server/actions/settings/branch-actions";
import { cn } from "@/lib/utils";
import { BranchFormSheet } from "./branch-form-sheet";

type BranchRow = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  deletedAt: Date | null;
  createdAt: Date;
};

type Props = {
  rows: BranchRow[];
};

function formatCreatedAt(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function BranchesList({ rows }: Props) {
  const [editing, setEditing] = useState<BranchRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deactivating, setDeactivating] = useState<{
    branch: BranchRow;
    counts?: { members: number; staff: number };
    code?: string;
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const active = rows.filter((b) => b.isActive);
  const inactive = rows.filter((b) => !b.isActive);

  function handleDeactivate(branch: BranchRow) {
    setDeactivating({ branch, message: "Confirm deactivation?" });
  }

  function confirmDeactivate(branch: BranchRow) {
    startTransition(async () => {
      const result = await deactivateBranchAction({ branchId: branch.id });
      if (!result.ok) {
        setDeactivating({
          branch,
          counts: result.counts,
          code: result.code,
          message: result.error,
        });
        return;
      }
      toast.success(`${branch.name} deactivated.`);
      setDeactivating(null);
    });
  }

  function handleReactivate(branch: BranchRow) {
    startTransition(async () => {
      const result = await reactivateBranchAction({ branchId: branch.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${branch.name} reactivated.`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setEditing(null);
            setCreateOpen(true);
          }}
        >
          <Plus className="size-4" />
          Add branch
        </Button>
      </div>

      <Section
        title="Active"
        rows={active}
        onEdit={(b) => setEditing(b)}
        onDeactivate={handleDeactivate}
        onReactivate={handleReactivate}
        formatCreatedAt={formatCreatedAt}
      />

      {inactive.length > 0 ? (
        <Section
          title="Inactive"
          rows={inactive}
          onEdit={(b) => setEditing(b)}
          onDeactivate={handleDeactivate}
          onReactivate={handleReactivate}
          formatCreatedAt={formatCreatedAt}
        />
      ) : null}

      <BranchFormSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        branch={null}
      />
      <BranchFormSheet
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        branch={editing}
      />

      <AlertDialog
        open={deactivating !== null}
        onOpenChange={(o) => !o && setDeactivating(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deactivating?.code ? "Cannot deactivate" : "Deactivate branch?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deactivating?.message}
              {deactivating?.counts ? (
                <span className="text-foreground mt-2 block">
                  Active members: {deactivating.counts.members.toLocaleString("en-IN")}
                  {" · "}
                  Active staff: {deactivating.counts.staff.toLocaleString("en-IN")}
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {deactivating?.code ? (
              <AlertDialogAction
                onClick={() => setDeactivating(null)}
                className="w-fit"
              >
                OK
              </AlertDialogAction>
            ) : (
              <>
                <AlertDialogCancel className="w-fit">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={isPending}
                  onClick={() =>
                    deactivating && confirmDeactivate(deactivating.branch)
                  }
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-fit"
                >
                  Deactivate
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Section({
  title,
  rows,
  onEdit,
  onDeactivate,
  onReactivate,
  formatCreatedAt,
}: {
  title: string;
  rows: BranchRow[];
  onEdit: (b: BranchRow) => void;
  onDeactivate: (b: BranchRow) => void;
  onReactivate: (b: BranchRow) => void;
  formatCreatedAt: (d: Date) => string;
}) {
  if (rows.length === 0) return null;
  return (
    <section
      data-slot="card"
      className="bg-gradient-to-t from-primary/5 to-card text-card-foreground ring-foreground/10 dark:bg-card overflow-hidden rounded-xl ring-1 shadow-xs"
    >
      <header className="px-5 pt-4 pb-2">
        <h3 className="text-foreground text-sm font-semibold tracking-tight">
          {title}
        </h3>
      </header>
      <ul className="divide-border divide-y">
        {rows.map((b) => (
          <li
            key={b.id}
            className="flex items-start justify-between gap-3 px-5 py-3 text-sm"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    b.isActive ? "bg-emerald-500" : "bg-muted-foreground/40",
                  )}
                />
                <p className="text-foreground font-medium">{b.name}</p>
              </div>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {b.isActive
                  ? `Created ${formatCreatedAt(b.createdAt)}`
                  : `Deactivated ${b.deletedAt ? formatCreatedAt(b.deletedAt) : ""}`}
                {b.phone ? ` · ${formatPhoneForDisplay(b.phone)}` : ""}
              </p>
              {b.address ? (
                <p className="text-muted-foreground/80 text-xs">
                  {b.address}
                </p>
              ) : null}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Branch actions">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-auto min-w-fit">
                <DropdownMenuItem onClick={() => onEdit(b)}>Edit</DropdownMenuItem>
                {b.isActive ? (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDeactivate(b)}
                  >
                    Deactivate
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onReactivate(b)}>
                    <RotateCcw className="size-3.5" />
                    Reactivate
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>
    </section>
  );
}
