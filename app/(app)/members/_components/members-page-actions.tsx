"use client";

import { Plus, Upload } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ExcelExportButton } from "@/components/shared/excel-export-button";
import type { MemberListRow } from "@/server/queries/members/list-members";
import type { AddOn } from "@/lib/db/schema/add-ons";
import type { Plan } from "@/lib/db/schema/plans";
import { formatPhoneForDisplay } from "@/lib/utils/phone";
import { MemberFormSheet } from "./member-form-sheet";

type Branch = { id: string; name: string };

type MembersPageActionsProps = {
  branches: Branch[];
  defaultBranchId: string;
  canEdit: boolean;
  exportRows: MemberListRow[];
  exportFilenameStem: string;
  plans?: Plan[];
  addOns?: AddOn[];
};

export function MembersPageActions({
  branches,
  defaultBranchId,
  canEdit,
  exportRows,
  exportFilenameStem,
  plans,
  addOns,
}: MembersPageActionsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <ExcelExportButton
        filename={`${exportFilenameStem}.xlsx`}
        sheetName="Members"
        fetchRows={async () =>
          exportRows.map((r) => ({
            Name: r.name,
            Phone: formatPhoneForDisplay(r.phone),
            Email: r.email ?? "",
            Branch: r.branchName,
            Gender: r.gender ?? "",
            DOB: r.dob ?? "",
            Joined: r.joinedDate,
            Address: r.address ?? "",
            Notes: r.notes ?? "",
          }))
        }
      />
      {canEdit ? (
        <>
          <Button asChild variant="ghost" size="sm">
            <Link href="/members/import">
              <Upload className="size-4" />
              Import CSV
            </Link>
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            Add member
          </Button>
          <MemberFormSheet
            open={open}
            onOpenChange={setOpen}
            branches={branches}
            defaultBranchId={defaultBranchId}
            member={null}
            enrollmentOptions={
              plans && addOns ? { plans, addOns } : undefined
            }
          />
        </>
      ) : null}
    </div>
  );
}
