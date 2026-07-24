import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { requireRole } from "@/lib/auth/get-session";
import {
  isValidDateRange,
  resolvePreset,
  type DateRange,
} from "@/lib/utils/date-presets";
import { listAuditEntries } from "@/server/queries/audit-log/list-audit-entries";
import { listAuditUsers } from "@/server/queries/audit-log/list-audit-users";
import { listDistinctEntityActions } from "@/server/queries/audit-log/list-distinct-actions";
import { AuditEntryRow } from "./_components/audit-entry-row";
import { AuditExportTrigger } from "./_components/audit-export-trigger";
import { AuditFilters } from "./_components/audit-filters";
import { AuditPagination } from "./_components/audit-pagination";
import { EntityContextBanner } from "./_components/entity-context-banner";

export const metadata: Metadata = { title: "Audit log" };

type SearchParams = Record<string, string | string[] | undefined>;

function asString(value: SearchParams[string]): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function resolveRange(params: SearchParams): DateRange {
  const from = asString(params.from);
  const to = asString(params.to);
  if (from && to && isValidDateRange({ from, to })) return { from, to };
  // Default to "Last 7 days" — audit is forensic; recent matters most.
  return resolvePreset("last_7_days");
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  await requireRole("owner", "branch_manager");

  const range = resolveRange(params);
  const entityType = asString(params.entity_type) ?? null;
  const action = asString(params.action) ?? null;
  const userId = asString(params.user_id) ?? null;
  const entityId = asString(params.entity_id) ?? null;
  const page = Math.max(1, Number(asString(params.page) ?? "1") || 1);

  const [result, distincts, users] = await Promise.all([
    listAuditEntries({
      fromDate: range.from,
      toDate: range.to,
      entityType: entityType ?? undefined,
      action: action ?? undefined,
      userId: userId ?? undefined,
      entityId: entityId ?? undefined,
      page,
    }),
    listDistinctEntityActions(),
    listAuditUsers(),
  ]);

  const filenameStem = `audit-log-${range.from}-to-${range.to}`;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Audit log"
        description="Every change made in your gym, with full history."
        actions={
          <AuditExportTrigger
            rows={result.rows}
            filenameStem={filenameStem}
          />
        }
      />
      <AuditFilters
        range={range}
        entityType={entityType}
        action={action}
        userId={userId}
        entityTypes={distincts.entityTypes}
        actions={distincts.actions}
        users={users}
      />
      {entityType && entityId ? (
        <EntityContextBanner entityType={entityType} entityId={entityId} />
      ) : null}
      <p className="text-muted-foreground mt-4 text-xs">
        Showing {result.rows.length.toLocaleString("en-IN")} of{" "}
        {result.total.toLocaleString("en-IN")} entries
      </p>
      {result.rows.length === 0 ? (
        <div
          data-slot="card"
          className="bg-gradient-to-t from-primary/5 to-card ring-foreground/10 mt-4 rounded-xl py-12 text-center ring-1 shadow-xs"
        >
          <p className="text-foreground text-sm font-medium">
            No audit entries match these filters.
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Try widening your date range or removing a filter.
          </p>
        </div>
      ) : (
        <section
          data-slot="card"
          className="bg-gradient-to-t from-primary/5 to-card text-card-foreground ring-foreground/10 dark:bg-card mt-4 overflow-hidden rounded-xl ring-1 shadow-xs"
        >
          <ul>
            {result.rows.map((entry) => (
              <AuditEntryRow key={entry.id} entry={entry} />
            ))}
          </ul>
        </section>
      )}
      <AuditPagination
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
      />
    </div>
  );
}
