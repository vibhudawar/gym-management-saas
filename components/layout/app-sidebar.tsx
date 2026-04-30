"use client";

import {
  CalendarDays,
  CreditCard,
  FileText,
  History,
  LayoutDashboard,
  ListChecks,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { Role } from "@/lib/auth/roles";
import { BranchSelector } from "./branch-selector";
import { UserMenu } from "./user-menu";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: ReadonlyArray<Role>;
};

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { href: "/", label: "Today", icon: LayoutDashboard },
  { href: "/members", label: "Members", icon: Users },
  { href: "/enrollments", label: "Enrollments", icon: CalendarDays },
  { href: "/plans", label: "Plans", icon: ListChecks },
  { href: "/payments", label: "Payments", icon: CreditCard },
  {
    href: "/reports",
    label: "Reports",
    icon: FileText,
    roles: ["owner", "branch_manager"],
  },
  {
    href: "/audit-log",
    label: "Audit log",
    icon: History,
    roles: ["owner", "branch_manager"],
  },
  { href: "/settings", label: "Settings", icon: Settings },
];

type AppSidebarProps = {
  gymName: string;
  subscriptionTier: "basic" | "pro";
  branches: ReadonlyArray<{ id: string; name: string }>;
  activeBranchId: string | null;
  user: { name: string; email: string; role: Role; roleLabel: string };
};

export function AppSidebar({
  gymName,
  subscriptionTier,
  branches,
  activeBranchId,
  user,
}: AppSidebarProps) {
  const pathname = usePathname();
  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(user.role),
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-0 p-0">
        <div className="flex h-14 items-center border-b px-3 group-data-[collapsible=icon]:hidden">
          <div className="min-w-0">
            <p className="text-muted-foreground text-[11px] leading-none font-medium tracking-wide uppercase">
              Gym
            </p>
            <p className="text-foreground mt-1 truncate text-sm leading-none font-semibold">
              {gymName}
            </p>
          </div>
        </div>
        <div className="px-3 py-2 group-data-[collapsible=icon]:hidden">
          <BranchSelector
            branches={[...branches]}
            activeBranchId={activeBranchId}
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href ||
                      pathname?.startsWith(`${item.href}/`);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <Link href={item.href}>
                        <Icon className="size-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-1 border-t p-2">
        <div className="flex items-center justify-between px-2 py-1 group-data-[collapsible=icon]:hidden">
          <span className="text-muted-foreground text-xs">Plan</span>
          <Badge
            variant={subscriptionTier === "pro" ? "default" : "secondary"}
            className="gap-1"
          >
            {subscriptionTier === "pro" ? (
              <ShieldCheck className="size-3" />
            ) : null}
            {subscriptionTier === "pro" ? "Pro" : "Basic"}
          </Badge>
        </div>
        <UserMenu
          name={user.name}
          email={user.email}
          roleLabel={user.roleLabel}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
