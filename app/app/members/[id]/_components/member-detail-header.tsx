"use client";

import {
  ArrowLeft,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import type { Member } from "@/lib/db/schema/members";
import { formatCalendarDate } from "@/lib/utils/dates";
import { formatPhoneForDisplay } from "@/lib/utils/phone";
import { restoreMember } from "@/server/actions/members/restore-member";
import { softDeleteMember } from "@/server/actions/members/soft-delete-member";
import { MemberFormSheet } from "../../_components/member-form-sheet";

type Branch = { id: string; name: string };

type MemberDetailHeaderProps = {
  member: Member & { branchName: string };
  branches: Branch[];
  canEdit: boolean;
  canDelete: boolean;
  canRestore: boolean;
};

export function MemberDetailHeader({
  member,
  branches,
  canEdit,
  canDelete,
  canRestore,
}: MemberDetailHeaderProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isDeleted = member.deletedAt !== null;

  function handleDelete() {
    startTransition(async () => {
      const result = await softDeleteMember(member.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${member.name} deleted`);
      router.push("/members");
    });
  }

  function handleRestore() {
    startTransition(async () => {
      const result = await restoreMember(member.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${member.name} restored`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 pb-4">
      <div className="space-y-2">
        <Link
          href="/members"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          <ArrowLeft className="size-3.5" />
          Back to members
        </Link>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          {member.name}
          {isDeleted ? (
            <span className="text-muted-foreground ml-2 text-xs font-normal align-middle">
              (deleted)
            </span>
          ) : null}
        </h1>
        <p className="text-muted-foreground text-sm">
          {formatPhoneForDisplay(member.phone)} · {member.branchName} · Joined{" "}
          {formatCalendarDate(member.joinedDate)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {canEdit && !isDeleted ? (
          <Button onClick={() => setEditOpen(true)} disabled={isPending}>
            <Pencil className="size-4" />
            Edit
          </Button>
        ) : null}
        {canDelete || canRestore ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto min-w-fit">
              {canDelete && !isDeleted ? (
                <DropdownMenuItem
                  onClick={() => setConfirmDelete(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="size-4" />
                  Delete member
                </DropdownMenuItem>
              ) : null}
              {canRestore && isDeleted ? (
                <DropdownMenuItem onClick={handleRestore}>
                  <RotateCcw className="size-4" />
                  Restore member
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <MemberFormSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        branches={branches}
        defaultBranchId={member.branchId}
        member={member}
        showAddAnother={false}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {member.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This member will be hidden from lists. You can restore them later
              from the Deleted tab.
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
    </div>
  );
}
