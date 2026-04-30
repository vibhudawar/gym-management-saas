"use client";

import { Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function TopBar() {
  return (
    <header className="bg-background sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <button
        type="button"
        disabled
        aria-label="Search (coming soon)"
        className="text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted/60 flex h-9 w-full max-w-md items-center gap-2 rounded-md border px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-70"
      >
        <Search className="size-4" />
        <span>Search…</span>
        <kbd className="text-muted-foreground bg-background ml-auto rounded border px-1.5 py-0.5 font-mono text-[10px]">
          ⌘K
        </kbd>
      </button>
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
