import { and, eq, isNull } from "drizzle-orm";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireUser } from "@/lib/auth/get-session";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { branches } from "@/lib/db/schema/branches";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireUser();

  const branchRows = await db
    .select({ id: branches.id, name: branches.name })
    .from(branches)
    .where(
      and(
        eq(branches.gymId, session.gym.id),
        eq(branches.isActive, true),
        isNull(branches.deletedAt),
      ),
    )
    .orderBy(branches.name);

  return (
    <SidebarProvider>
      <AppSidebar
        gymName={session.gym.name}
        subscriptionTier={session.gym.subscriptionTier}
        branches={branchRows}
        activeBranchId={session.branch?.id ?? null}
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
