import { PageHeader } from "@/components/layout/page-header";
import { requireUser } from "@/lib/auth/get-session";
import { SettingsNav } from "./_components/settings-nav";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireUser();
  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="Settings"
        description="Configure your gym, account, and integrations."
      />
      <div className="mt-2 grid gap-6 lg:grid-cols-[200px_1fr]">
        <aside className="lg:sticky lg:top-2 lg:self-start">
          <SettingsNav role={session.user.role} />
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
