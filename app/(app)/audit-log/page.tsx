import { PageHeader } from "@/components/layout/page-header";
import { requireRole } from "@/lib/auth/get-session";

export default async function AuditLogPage() {
  await requireRole("owner", "branch_manager");

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Audit log"
        description="Audit log viewer lands in Module 08."
      />
      <div className="bg-card text-muted-foreground rounded-xl border p-6 text-sm">
        Audit rows are being recorded already — viewer UI lands in Module 08.
      </div>
    </div>
  );
}
