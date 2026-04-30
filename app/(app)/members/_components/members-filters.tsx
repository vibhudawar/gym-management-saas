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
import { cn } from "@/lib/utils";
import type { MembershipStatusCounts } from "@/server/queries/members/count-members-by-status";

type Branch = { id: string; name: string };

type MembershipStatusKey =
  | "all"
  | "active"
  | "expiring"
  | "expired"
  | "no_membership";

type MembersFiltersProps = {
  branches: Branch[];
  showBranchFilter: boolean;
  showDeletedTab: boolean;
  membershipStatus: MembershipStatusKey;
  counts: MembershipStatusCounts | null;
};

export function MembersFilters({
  branches,
  showBranchFilter,
  showDeletedTab,
  membershipStatus,
  counts,
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
    if (nextQuery === currentQuery) return;
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

  function setMembershipStatus(next: MembershipStatusKey) {
    if (next === membershipStatus) return;
    pushParams((params) => {
      if (next === "all") params.delete("membership");
      else params.set("membership", next);
    });
  }

  return (
    <div className="bg-background sticky top-14 z-20 flex flex-col gap-2 border-b py-3">
      <div className="flex flex-wrap items-center gap-2">
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

      {counts && status === "active" ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill
            label="All"
            count={counts.total}
            active={membershipStatus === "all"}
            onClick={() => setMembershipStatus("all")}
          />
          <Pill
            label="Active"
            count={counts.active}
            dot="bg-emerald-500"
            active={membershipStatus === "active"}
            onClick={() => setMembershipStatus("active")}
          />
          <Pill
            label="Expiring soon"
            count={counts.expiring}
            dot="bg-amber-500"
            active={membershipStatus === "expiring"}
            onClick={() => setMembershipStatus("expiring")}
          />
          <Pill
            label="Expired"
            count={counts.expired}
            dot="bg-destructive"
            active={membershipStatus === "expired"}
            onClick={() => setMembershipStatus("expired")}
          />
          <Pill
            label="No membership"
            count={counts.noMembership}
            dot="bg-muted-foreground/40"
            active={membershipStatus === "no_membership"}
            onClick={() => setMembershipStatus("no_membership")}
          />
        </div>
      ) : null}
    </div>
  );
}

function Pill({
  label,
  count,
  dot,
  active,
  onClick,
}: {
  label: string;
  count: number;
  dot?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border hover:bg-muted/40 text-foreground",
      )}
    >
      {dot ? <span className={cn("size-1.5 rounded-full", dot)} /> : null}
      <span>{label}</span>
      <span
        className={cn(
          "tabular-nums",
          active ? "text-background/80" : "text-muted-foreground",
        )}
      >
        {count.toLocaleString("en-IN")}
      </span>
    </button>
  );
}
