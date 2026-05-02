import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/get-session";
import { listActiveBranches } from "@/server/queries/branches/list-active-branches";
import { listMemberPhones } from "@/server/actions/members/list-member-phones";
import { ImportWizard } from "./_components/import-wizard";

export const metadata: Metadata = { title: "Import members" };

export default async function MembersImportPage() {
  const session = await requireRole("owner", "branch_manager");
  const [branches, phones] = await Promise.all([
    listActiveBranches(),
    listMemberPhones(),
  ]);

  if (branches.length === 0) {
    redirect("/members");
  }

  const defaultBranchId = session.activeBranch?.id ?? branches[0].id;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <ImportWizard
        branches={branches}
        defaultBranchId={defaultBranchId}
        existingPhones={phones}
      />
    </div>
  );
}
