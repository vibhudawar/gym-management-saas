import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { requireUser } from "@/lib/auth/get-session";
import { isManagerOrOwner, isOwner } from "@/lib/auth/roles";
import { listActiveBranches } from "@/server/queries/branches/list-active-branches";
import { listMembers } from "@/server/queries/members/list-members";
import { MembersFilters } from "./_components/members-filters";
import { MembersListClient } from "./_components/members-list-client";
import { MembersPageActions } from "./_components/members-page-actions";

export const metadata: Metadata = { title: "Members" };

type SearchParams = Record<string, string | string[] | undefined>;

function asString(value: SearchParams[string]): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const session = await requireUser();
  const owner = isOwner(session.user.role);
  const canEdit = isManagerOrOwner(session.user.role);

  const branches = await listActiveBranches();
  const showBranchFilter = owner && branches.length > 1;
  const showBranchColumn = branches.length > 1;
  const showDeletedTab = owner;

  const search = asString(params.q)?.trim();
  const branchFilter = asString(params.branch);
  const statusParam =
    asString(params.status) === "deleted" && owner ? "deleted" : "active";
  const page = Math.max(1, Number(asString(params.page) ?? "1") || 1);
  const pageSize = 50;

  const result = await listMembers({
    search,
    branchId: branchFilter,
    status: statusParam,
    page,
    pageSize,
    sortBy: "name",
    sortDir: "asc",
  });

  const subtitle =
    branches.length > 1
      ? `${result.total.toLocaleString("en-IN")} members across ${branches.length} branches`
      : `${result.total.toLocaleString("en-IN")} members`;

  const defaultBranchId = session.branch?.id ?? branches[0]?.id ?? "";
  const filterApplied = !!(search || (branchFilter && branchFilter !== "all") || statusParam === "deleted");

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        title="Members"
        description={subtitle}
        actions={
          <MembersPageActions
            branches={branches}
            defaultBranchId={defaultBranchId}
            canEdit={canEdit}
            exportRows={result.rows}
            exportFilenameStem={`members-${session.gym.name.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}`}
          />
        }
      />
      <MembersFilters
        branches={branches}
        showBranchFilter={showBranchFilter}
        showDeletedTab={showDeletedTab}
      />
      <div className="mt-4">
        <MembersListClient
          rows={result.rows}
          total={result.total}
          page={result.page}
          pageSize={result.pageSize}
          branches={branches}
          defaultBranchId={defaultBranchId}
          showBranchColumn={showBranchColumn}
          canEdit={canEdit}
          canDelete={canEdit}
          canRestore={owner}
          status={statusParam}
          hasFiltersApplied={filterApplied}
          onClearFilters="/members"
        />
      </div>
    </div>
  );
}
