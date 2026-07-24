"use client";

import {
  Bell,
  Building2,
  CreditCard,
  Download,
  User,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Role } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

type Section = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: ReadonlyArray<Role>;
};

const SECTIONS: Section[] = [
  { href: "/app/settings/gym", label: "Gym profile", icon: Building2, roles: ["owner"] },
  { href: "/app/settings/branches", label: "Branches", icon: Users, roles: ["owner"] },
  {
    href: "/app/settings/notifications",
    label: "Notifications",
    icon: Bell,
    roles: ["owner"],
  },
  {
    href: "/app/settings/subscription",
    label: "Subscription",
    icon: CreditCard,
    roles: ["owner"],
  },
  { href: "/app/settings/account", label: "Account", icon: User },
  {
    href: "/app/settings/export",
    label: "Data export",
    icon: Download,
    roles: ["owner"],
  },
];

type Props = {
  role: Role;
};

export function SettingsNav({ role }: Props) {
  const pathname = usePathname();
  const visible = SECTIONS.filter((s) => !s.roles || s.roles.includes(role));

  return (
    <>
      {/* Desktop left rail */}
      <nav className="hidden lg:block">
        <ul className="space-y-1">
          {visible.map((s) => (
            <NavItem key={s.href} section={s} pathname={pathname ?? ""} />
          ))}
        </ul>
      </nav>
      {/* Mobile select */}
      <div className="lg:hidden">
        <Select
          value={pathname}
          onValueChange={(v) => {
            // Hard-navigate so server-rendering kicks in.
            window.location.assign(v);
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {visible.map((s) => (
              <SelectItem key={s.href} value={s.href}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

function NavItem({
  section,
  pathname,
}: {
  section: Section;
  pathname: string;
}) {
  const isActive = pathname === section.href;
  const Icon = section.icon;
  return (
    <li>
      <Link
        href={section.href}
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-foreground hover:bg-muted/40",
        )}
      >
        <Icon className="size-3.5" />
        {section.label}
      </Link>
    </li>
  );
}
