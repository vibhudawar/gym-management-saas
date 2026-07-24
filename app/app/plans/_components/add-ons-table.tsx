"use client";

import { Loader2, MoreHorizontal, Pencil, Power, PowerOff } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AddOn } from "@/lib/db/schema/add-ons";
import { formatMoney } from "@/lib/utils/money";
import { toggleAddOnActive } from "@/server/actions/add-ons/toggle-add-on-active";

type AddOnsTableProps = {
  addOns: AddOn[];
  canEdit: boolean;
  onEdit: (addOn: AddOn) => void;
};

export function AddOnsTable({ addOns, canEdit, onEdit }: AddOnsTableProps) {
  return (
    <div className="bg-card rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Auto-apply</TableHead>
            <TableHead>Status</TableHead>
            {canEdit ? <TableHead className="w-12" /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {addOns.map((addOn) => (
            <Row
              key={addOn.id}
              addOn={addOn}
              canEdit={canEdit}
              onEdit={onEdit}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

type RowProps = {
  addOn: AddOn;
  canEdit: boolean;
  onEdit: (addOn: AddOn) => void;
};

function Row({ addOn, canEdit, onEdit }: RowProps) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleAddOnActive(addOn.id, !addOn.isActive);
      if (!result.ok) {
        toast.error(result.error);
      } else {
        toast.success(addOn.isActive ? "Add-on deactivated" : "Add-on reactivated");
      }
    });
  }

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col gap-1">
          <span className="text-foreground text-sm font-medium">
            {addOn.name}
          </span>
          <Badge variant="outline" className="w-fit text-[10px] tracking-wide uppercase">
            {addOn.type === "one_time" ? "One-time" : "Recurring"}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="text-foreground text-right font-medium tabular-nums">
        {formatMoney(addOn.amountPaise)}
      </TableCell>
      <TableCell>
        {addOn.autoApplyOnFirstEnrollment ? (
          <Badge variant="default">Yes</Badge>
        ) : (
          <Badge variant="secondary">No</Badge>
        )}
      </TableCell>
      <TableCell>
        {addOn.isActive ? (
          <span className="text-foreground inline-flex items-center gap-1.5 text-sm">
            <span className="size-1.5 rounded-full bg-emerald-500" /> Active
          </span>
        ) : (
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
            <span className="bg-muted-foreground/40 size-1.5 rounded-full" />{" "}
            Inactive
          </span>
        )}
      </TableCell>
      {canEdit ? (
        <TableCell>
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Edit add-on"
              onClick={() => onEdit(addOn)}
              disabled={isPending}
            >
              <Pencil className="size-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Add-on actions"
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <MoreHorizontal className="size-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {addOn.isActive ? (
                  <DropdownMenuItem onClick={handleToggle}>
                    <PowerOff className="size-4" />
                    Deactivate
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={handleToggle}>
                    <Power className="size-4" />
                    Reactivate
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      ) : null}
    </TableRow>
  );
}
