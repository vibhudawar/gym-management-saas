"use client";

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { GlobalSearchTrigger } from "./global-search";

export function TopBar() {
  return (
    <header className="bg-background sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <GlobalSearchTrigger />
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          disabled
          className="text-muted-foreground"
        >
          <Bell className="size-4" />
        </Button>
      </div>
    </header>
  );
}
