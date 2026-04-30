import { PageHeader } from "@/components/layout/page-header";
import { requireRole } from "@/lib/auth/get-session";

export default async function ReportsPage() {
  await requireRole("owner", "branch_manager");

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Reports"
        description="Reports land in Module 07."
      />
      <div className="bg-card text-muted-foreground rounded-xl border p-6 text-sm">
        Coming soon.
      </div>
    </div>
  );
}
