"use client";

import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { DensityToggle, useDensity } from "@/components/shared/density-toggle";

type Branch = { id: string; name: string };

type MembersFiltersProps = {
  branches: Branch[];
  showBranchFilter: boolean;
  showDeletedTab: boolean;
};

export function MembersFilters({
  branches,
  showBranchFilter,
  showDeletedTab,
}: MembersFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initialSearch = searchParams.get("q") ?? "";
  const [search, setSearch] = useState(initialSearch);
  const [density, setDensity] = useDensity();

  const branchValue = searchParams.get("branch") ?? "all";
  const status = searchParams.get("status") === "deleted" ? "deleted" : "active";

  function pushParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    params.delete("page");
    const nextQuery = params.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery === currentQuery) return; // no-op if filter didn't change
    router.replace(nextQuery ? `/members?${nextQuery}` : "/members");
  }

  function handleSearchChange(next: string) {
    setSearch(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushParams((params) => {
        if (next.trim()) params.set("q", next.trim());
        else params.delete("q");
      });
    }, 250);
  }

  function clearSearch() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearch("");
    pushParams((params) => params.delete("q"));
  }

  return (
    <div className="bg-background sticky top-14 z-20 flex flex-wrap items-center gap-2 border-b py-3">
      <div className="relative min-w-[240px] flex-1">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => handleSearchChange(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && search) {
              e.preventDefault();
              clearSearch();
            }
          }}
          placeholder="Search by name or phone…"
          className="pl-9"
          aria-label="Search members"
        />
        {search ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={clearSearch}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded p-1"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      {showBranchFilter ? (
        <Select
          value={branchValue}
          onValueChange={(v) => {
            if (v === branchValue) return;
            pushParams((params) => {
              if (v === "all") params.delete("branch");
              else params.set("branch", v);
            });
          }}
        >
          <SelectTrigger className="w-[200px]" aria-label="Branch filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All branches</SelectItem>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {showDeletedTab ? (
        <Tabs
          value={status}
          onValueChange={(v) => {
            if (v === status) return;
            pushParams((params) => {
              if (v === "deleted") params.set("status", "deleted");
              else params.delete("status");
            });
          }}
        >
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="deleted">Deleted</TabsTrigger>
          </TabsList>
        </Tabs>
      ) : null}

      <div className="ml-auto">
        <DensityToggle density={density} onChange={setDensity} />
      </div>
    </div>
  );
}
