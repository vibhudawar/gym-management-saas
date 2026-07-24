"use client";

import { ReportExportButton } from "@/app/(app)/reports/_components/export-button";
import type { AuditEntry } from "@/server/queries/audit-log/list-audit-entries";
import { formatDate, formatDateTime } from "@/lib/utils/dates";
import { ROLE_LABEL, type Role } from "@/lib/auth/roles";

type Props = {
  rows: AuditEntry[];
  filenameStem: string;
};

/**
 * Reuses the SheetJS-backed export button from Reports. JSON columns are
 * pretty-printed strings since Excel doesn't carry nested JSON cells —
 * paste them into a JSON viewer if you need structure.
 */
export function AuditExportTrigger({ rows, filenameStem }: Props) {
  return (
    <ReportExportButton
      filename={filenameStem}
      sheetName="Audit log"
      buildRows={async () => ({
        rows: rows.map((r) => ({
          Date: formatDate(r.createdAt),
          Time: formatDateTime(r.createdAt),
          User: r.user.name ?? "(removed)",
          Role: r.user.role ? ROLE_LABEL[r.user.role as Role] : "",
          Entity: `${r.entityType}: ${r.entityLabel}`,
          Action: r.action,
          Branch: r.branchName ?? "",
          "Before (JSON)":
            r.beforeJson === null || r.beforeJson === undefined
              ? ""
              : JSON.stringify(r.beforeJson, null, 2),
          "After (JSON)":
            r.afterJson === null || r.afterJson === undefined
              ? ""
              : JSON.stringify(r.afterJson, null, 2),
        })),
      })}
    />
  );
}
