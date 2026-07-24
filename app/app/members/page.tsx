import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { requireUser } from "@/lib/auth/get-session";
import { isManagerOrOwner, isOwner } from "@/lib/auth/roles";
import { listActiveBranches } from "@/server/queries/branches/list-active-branches";
import { listAddOns } from "@/server/queries/add-ons/list-add-ons";
import { listMembers } from "@/server/queries/members/list-members";
import {
  countMembersByStatus,
  type MembershipStatusCounts,
} from "@/server/queries/members/count-members-by-status";
import { listPlans } from "@/server/queries/plans/list-plans";
import { todayIstIso } from "@/lib/utils/dates";
import { MembersFilters } from "./_components/members-filters";
import { MembersListClient } from "./_components/members-list-client";
import { MembersPageActions } from "./_components/members-page-actions";

export const metadata: Metadata = { title: "Members" };

type SearchParams = Record<string, string | string[] | undefined>;

function asString(value: SearchParams[string]): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

const VALID_MEMBERSHIP_STATUSES = [
  "all",
  "active",
  "expiring",
  "expired",
  "frozen",
  "no_membership",
] as const;

type MembershipStatusFilter = (typeof VALID_MEMBERSHIP_STATUSES)[number];

const VALID_SORT_BY = ["name", "joined_date", "membership"] as const;
type SortBy = (typeof VALID_SORT_BY)[number];
const VALID_SORT_DIR = ["asc", "desc"] as const;
type SortDir = (typeof VALID_SORT_DIR)[number];

const DEFAULT_SORT_DIR: Record<SortBy, SortDir> = {
  name: "asc",
  joined_date: "desc",
  membership: "asc",
};

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
  const membershipStatusRaw = asString(params.membership);
  const membershipStatus: MembershipStatusFilter =
    VALID_MEMBERSHIP_STATUSES.includes(
      membershipStatusRaw as MembershipStatusFilter,
    )
      ? (membershipStatusRaw as MembershipStatusFilter)
      : "all";
  const page = Math.max(1, Number(asString(params.page) ?? "1") || 1);
  const pageSize = 50;

  const sortByRaw = asString(params.sort) as SortBy | undefined;
  const sortDirRaw = asString(params.dir) as SortDir | undefined;
  const sortBy: SortBy = VALID_SORT_BY.includes(sortByRaw as SortBy)
    ? (sortByRaw as SortBy)
    : "name";
  const sortDir: SortDir = VALID_SORT_DIR.includes(sortDirRaw as SortDir)
    ? (sortDirRaw as SortDir)
    : DEFAULT_SORT_DIR[sortBy];

  const [result, counts, plans, addOns] = await Promise.all([
    listMembers({
      search,
      branchId: branchFilter,
      status: statusParam,
      membershipStatus,
      page,
      pageSize,
      sortBy,
      sortDir,
    }),
    statusParam === "active"
      ? countMembersByStatus(branchFilter)
      : (Promise.resolve(null) as Promise<MembershipStatusCounts | null>),
    canEdit ? listPlans() : Promise.resolve([]),
    canEdit ? listAddOns() : Promise.resolve([]),
  ]);

  const subtitle =
    branches.length > 1
      ? `${result.total.toLocaleString("en-IN")} members across ${branches.length} branches`
      : `${result.total.toLocaleString("en-IN")} members`;

  const defaultBranchId = session.activeBranch?.id ?? branches[0]?.id ?? "";
  const filterApplied = !!(
    search ||
    (branchFilter && branchFilter !== "all") ||
    statusParam === "deleted" ||
    membershipStatus !== "all"
  );

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
            exportFilenameStem={`members-${session.gym.name.toLowerCase().replace(/\s+/g, "-")}-${todayIstIso()}`}
            plans={plans}
            addOns={addOns}
          />
        }
      />
      <MembersFilters
        branches={branches}
        showBranchFilter={showBranchFilter}
        showDeletedTab={showDeletedTab}
        membershipStatus={membershipStatus}
        counts={counts}
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
          onClearFilters="/app/members"
          plans={plans}
          addOns={addOns}
          sortBy={sortBy}
          sortDir={sortDir}
        />
      </div>
    </div>
  );
}
