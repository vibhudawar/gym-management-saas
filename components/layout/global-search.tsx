"use client";

import { useQuery } from "@tanstack/react-query";
import { Search, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { formatPhoneForDisplay } from "@/lib/utils/phone";
import { searchMembersAction } from "@/server/actions/members/search-members-action";

export function GlobalSearchTrigger() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const trimmed = query.trim();
  const { data: hits, isFetching } = useQuery({
    queryKey: ["global-search", trimmed],
    queryFn: () => searchMembersAction(trimmed),
    enabled: open && trimmed.length >= 2,
    staleTime: 10_000,
  });

  function navigate(id: string) {
    setOpen(false);
    setQuery("");
    router.push(`/members/${id}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted/60 flex h-9 w-full max-w-md items-center gap-2 rounded-md border px-3 text-sm transition-colors"
      >
        <Search className="size-4" />
        <span>Search members…</span>
        <kbd className="text-muted-foreground bg-background ml-auto rounded border px-1.5 py-0.5 font-mono text-[10px]">
          ⌘K
        </kbd>
      </button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search members"
        description="Find a member by name or phone number."
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Type a name or phone number…"
          />
          <CommandList>
            {trimmed.length < 2 ? (
              <CommandEmpty>Type a name or phone number.</CommandEmpty>
            ) : isFetching ? (
              <CommandEmpty>Searching…</CommandEmpty>
            ) : (hits ?? []).length === 0 ? (
              <CommandEmpty>No members match &ldquo;{trimmed}&rdquo;.</CommandEmpty>
            ) : (
              <CommandGroup heading="Members">
                {(hits ?? []).map((hit) => (
                  <CommandItem
                    key={hit.id}
                    value={`${hit.name} ${hit.phone}`}
                    onSelect={() => navigate(hit.id)}
                  >
                    <User className="size-4" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-foreground truncate text-sm">{hit.name}</span>
                      <span className="text-muted-foreground truncate text-xs">
                        {formatPhoneForDisplay(hit.phone)} · {hit.branchName}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
