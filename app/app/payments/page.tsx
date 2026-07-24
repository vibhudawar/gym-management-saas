import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { requireUser } from "@/lib/auth/get-session";
import { isOwner } from "@/lib/auth/roles";
import { listActiveBranches } from "@/server/queries/branches/list-active-branches";
import {
  listPayments,
  type ListPaymentsInput,
} from "@/server/queries/payments/list-payments";
import { dateToIso } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";
import { paymentModes, type PaymentKind, type PaymentMode } from "@/lib/db/schema/payments";
import { PaymentsFilters } from "./_components/payments-filters";
import { PaymentsTable } from "./_components/payments-table";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata: Metadata = { title: "Payments" };

type SearchParams = Record<string, string | string[] | undefined>;

function asString(value: SearchParams[string]): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function defaultDateRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    from: dateToIso(start),
    to: dateToIso(now),
  };
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const session = await requireUser();
  const owner = isOwner(session.user.role);

  const branches = await listActiveBranches();
  const showBranchFilter = owner && branches.length > 1;
  const showBranchColumn = branches.length > 1;

  const fallback = defaultDateRange();
  const dateFrom = asString(params.from) ?? fallback.from;
  const dateTo = asString(params.to) ?? fallback.to;
  const branchFilter = asString(params.branch);
  const modeRaw = asString(params.mode);
  const kindRaw = asString(params.kind);
  const page = Math.max(1, Number(asString(params.page) ?? "1") || 1);

  const input: ListPaymentsInput = {
    branchId: branchFilter,
    dateFrom,
    dateTo,
    mode: modeRaw && (paymentModes as readonly string[]).includes(modeRaw)
      ? (modeRaw as PaymentMode)
      : undefined,
    kind:
      kindRaw === "payment" || kindRaw === "refund" || kindRaw === "all"
        ? (kindRaw as PaymentKind | "all")
        : "all",
    page,
    pageSize: 50,
  };

  const result = await listPayments(input);

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        title="Payments"
        description={`${result.total.toLocaleString("en-IN")} entries · Net ${formatMoney(result.netPaise)}`}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/payments?from=&to=">Clear filters</Link>
          </Button>
        }
      />
      <PaymentsFilters branches={branches} showBranchFilter={showBranchFilter} />
      <div className="mt-4">
        <PaymentsTable
          rows={result.rows}
          showBranch={showBranchColumn}
          showReceivedBy={owner}
        />
      </div>
    </div>
  );
}
