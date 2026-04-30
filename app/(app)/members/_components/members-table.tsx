"use client";

import { Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { useDensity, type Density } from "@/components/shared/density-toggle";
import type { MemberListRow } from "@/server/queries/members/list-members";
import { formatCalendarDate } from "@/lib/utils/dates";
import { formatPhoneForDisplay } from "@/lib/utils/phone";
import { restoreMember } from "@/server/actions/members/restore-member";
import { softDeleteMember } from "@/server/actions/members/soft-delete-member";
import { cn } from "@/lib/utils";

type MembersTableProps = {
  rows: MemberListRow[];
  showBranchColumn: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canRestore: boolean;
  onEdit: (row: MemberListRow) => void;
  status: "active" | "deleted";
};

export function MembersTable({
  rows,
  showBranchColumn,
  canEdit,
  canDelete,
  canRestore,
  onEdit,
  status,
}: MembersTableProps) {
  const router = useRouter();
  const [density] = useDensity();

  return (
    <div className="bg-card overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            {showBranchColumn ? <TableHead>Branch</TableHead> : null}
            <TableHead>Membership</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <Row
              key={row.id}
              row={row}
              showBranch={showBranchColumn}
              canEdit={canEdit}
              canDelete={canDelete}
              canRestore={canRestore}
              status={status}
              density={density}
              onEdit={onEdit}
              onClick={() => router.push(`/members/${row.id}`)}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

type RowProps = {
  row: MemberListRow;
  showBranch: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canRestore: boolean;
  status: "active" | "deleted";
  density: Density;
  onEdit: (row: MemberListRow) => void;
  onClick: () => void;
};

function Row({
  row,
  showBranch,
  canEdit,
  canDelete,
  canRestore,
  status,
  density,
  onEdit,
  onClick,
}: RowProps) {
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      const result = await softDeleteMember(row.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${row.name} deleted`, {
        action: {
          label: "Undo",
          onClick: async () => {
            const r = await restoreMember(row.id);
            if (!r.ok) toast.error(r.error);
            else toast.success("Restored");
          },
        },
        duration: 5000,
      });
    });
  }

  function handleRestore() {
    startTransition(async () => {
      const r = await restoreMember(row.id);
      if (!r.ok) toast.error(r.error);
      else toast.success("Member restored");
    });
  }

  const isDense = density === "dense";

  return (
    <>
      <TableRow
        className={cn(
          "hover:bg-muted/30 cursor-pointer",
          isDense ? "[&>td]:py-2" : "[&>td]:py-3",
        )}
        onClick={onClick}
      >
        <TableCell>
          <div className="flex flex-col gap-0.5">
            <span className="text-foreground text-sm font-medium">{row.name}</span>
            {!isDense ? (
              <span className="text-muted-foreground text-xs">
                Joined {formatCalendarDate(row.joinedDate)}
              </span>
            ) : null}
          </div>
        </TableCell>
        <TableCell className="font-mono text-sm">
          {formatPhoneForDisplay(row.phone)}
        </TableCell>
        {showBranch ? (
          <TableCell>
            <Badge variant="outline" className="text-xs">
              {row.branchName}
            </Badge>
          </TableCell>
        ) : null}
        <TableCell>
          <span className="text-muted-foreground text-xs">—</span>
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Member actions"
                disabled={isPending}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto min-w-fit">
              <DropdownMenuItem onClick={onClick}>
                <Eye className="size-4" />
                View
              </DropdownMenuItem>
              {canEdit && status === "active" ? (
                <DropdownMenuItem onClick={() => onEdit(row)}>
                  <Pencil className="size-4" />
                  Edit
                </DropdownMenuItem>
              ) : null}
              {canDelete && status === "active" ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setConfirmDelete(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              ) : null}
              {canRestore && status === "deleted" ? (
                <DropdownMenuItem onClick={handleRestore}>
                  Restore
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {row.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This member will be hidden from lists. You can restore them later from
              the Deleted tab.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="w-fit">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-fit"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
