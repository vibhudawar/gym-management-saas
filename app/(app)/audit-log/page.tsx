import type { Metadata } from "next";
import { Hammer } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { requireRole } from "@/lib/auth/get-session";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditLogPage() {
  await requireRole("owner", "branch_manager");

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader title="Audit log" />
      <EmptyState
        icon={Hammer}
        title="The audit-log viewer is coming soon"
        description="Every mutation is already being recorded; the dedicated viewer with filters lands in Module 08."
      />
    </div>
  );
}
