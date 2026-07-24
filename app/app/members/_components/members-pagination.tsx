"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

type MembersPaginationProps = {
  page: number;
  pageSize: number;
  total: number;
};

export function MembersPagination({ page, pageSize, total }: MembersPaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  function goTo(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage <= 1) params.delete("page");
    else params.set("page", String(nextPage));
    router.push(`/app/members?${params.toString()}`);
  }

  return (
    <div className="text-muted-foreground flex items-center justify-between gap-3 pt-4 text-sm">
      <span>
        {total === 0
          ? "No members"
          : `Showing ${start}–${end} of ${total.toLocaleString("en-IN")}`}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => goTo(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft className="size-4" />
          Previous
        </Button>
        <span className="text-foreground tabular-nums px-2 text-xs">
          {page} / {lastPage}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => goTo(page + 1)}
          disabled={page >= lastPage}
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
