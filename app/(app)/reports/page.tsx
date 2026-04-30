import type { Metadata } from "next";
import { Hammer } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { requireRole } from "@/lib/auth/get-session";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  await requireRole("owner", "branch_manager");

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader title="Reports" />
      <EmptyState
        icon={Hammer}
        title="Reports are on the way"
        description="Revenue summaries, expiring memberships, and CSV/Excel exports land in Module 07."
      />
    </div>
  );
}
