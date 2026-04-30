"use client";

import Link from "next/link";
import { Plus, Search, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import type { MemberListRow } from "@/server/queries/members/list-members";
import { MemberFormSheet } from "./member-form-sheet";
import { MembersPagination } from "./members-pagination";
import { MembersTable } from "./members-table";

type Branch = { id: string; name: string };

type MembersListClientProps = {
  rows: MemberListRow[];
  total: number;
  page: number;
  pageSize: number;
  branches: Branch[];
  defaultBranchId: string;
  showBranchColumn: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canRestore: boolean;
  status: "active" | "deleted";
  hasFiltersApplied: boolean;
  onClearFilters: string; // href to clear filters
};

export function MembersListClient({
  rows,
  total,
  page,
  pageSize,
  branches,
  defaultBranchId,
  showBranchColumn,
  canEdit,
  canDelete,
  canRestore,
  status,
  hasFiltersApplied,
  onClearFilters,
}: MembersListClientProps) {
  const [editing, setEditing] = useState<MemberListRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  if (rows.length === 0) {
    if (hasFiltersApplied) {
      return (
        <EmptyState
          icon={Search}
          title="No members match your search"
          action={
            <Button asChild variant="outline">
              <Link href={onClearFilters}>Clear search</Link>
            </Button>
          }
        />
      );
    }
    return (
      <EmptyState
        icon={Users}
        title="No members yet"
        description="Add your first member to start managing your gym."
        action={
          canEdit ? (
            <div className="flex items-center gap-2">
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                Add member
              </Button>
              <Button asChild variant="outline">
                <Link href="/members/import">Import from CSV</Link>
              </Button>
              <MemberFormSheet
                open={createOpen}
                onOpenChange={setCreateOpen}
                branches={branches}
                defaultBranchId={defaultBranchId}
                member={null}
              />
            </div>
          ) : undefined
        }
      />
    );
  }

  return (
    <>
      <MembersTable
        rows={rows}
        showBranchColumn={showBranchColumn}
        canEdit={canEdit}
        canDelete={canDelete}
        canRestore={canRestore}
        status={status}
        onEdit={(row) => setEditing(row)}
      />
      <MembersPagination page={page} pageSize={pageSize} total={total} />
      <MemberFormSheet
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        branches={branches}
        defaultBranchId={defaultBranchId}
        member={editing as unknown as Parameters<typeof MemberFormSheet>[0]["member"]}
        showAddAnother={false}
      />
    </>
  );
}
