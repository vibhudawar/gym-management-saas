import { PageHeader } from "@/components/layout/page-header";
import { requireUser } from "@/lib/auth/get-session";

export default async function SettingsPage() {
  await requireUser();

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Settings"
        description="Account and gym settings UI is scoped for a later module."
      />
      <div className="bg-card text-muted-foreground rounded-xl border p-6 text-sm">
        Coming soon.
      </div>
    </div>
  );
}
