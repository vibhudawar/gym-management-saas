import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireUser } from "@/lib/auth/get-session";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { listActiveBranches } from "@/server/queries/branches/list-active-branches";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireUser();
  const branchRows = await listActiveBranches();

  return (
    <SidebarProvider>
      <AppSidebar
        gymName={session.gym.name}
        subscriptionTier={session.gym.subscriptionTier}
        branches={branchRows}
        activeBranchId={session.activeBranch?.id ?? null}
        canSwitchAll={session.user.role === "owner"}
        user={{
          name: session.user.name,
          email: session.email,
          role: session.user.role,
          roleLabel: ROLE_LABEL[session.user.role],
        }}
      />
      <SidebarInset>
        <TopBar />
        <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
