import type { Metadata } from "next";
import { Hammer } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { requireUser } from "@/lib/auth/get-session";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireUser();

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title="Settings" />
      <EmptyState
        icon={Hammer}
        title="Settings are coming soon"
        description="Gym-level configuration (invoice prefix, currency, branding) and account settings will land in a later module."
      />
    </div>
  );
}
