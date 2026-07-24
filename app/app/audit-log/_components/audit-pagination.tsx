"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  page: number;
  pageSize: number;
  total: number;
};

export function AuditPagination({ page, pageSize, total }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function go(next: number) {
    const sp = new URLSearchParams(params.toString());
    if (next <= 1) sp.delete("page");
    else sp.set("page", String(next));
    startTransition(() => {
      router.replace(`?${sp.toString()}`, { scroll: false });
    });
  }

  if (total === 0) return null;

  return (
    <div className="flex items-center justify-between gap-3 px-1 py-3 text-xs">
      <p className="text-muted-foreground">
        Page {page} of {totalPages} · {total.toLocaleString("en-IN")} entries
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => go(page - 1)}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => go(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
