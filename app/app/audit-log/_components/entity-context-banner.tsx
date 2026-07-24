"use client";

import { X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

type Props = {
  entityType: string;
  entityId: string;
};

const ENTITY_LABEL: Record<string, string> = {
  member: "Member",
  payment: "Payment",
  membership: "Membership",
  plan: "Plan",
  addon: "Add-on",
  freeze: "Freeze",
  user: "User",
  gym: "Gym",
  branch: "Branch",
};

export function EntityContextBanner({ entityType, entityId }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  function clear() {
    const sp = new URLSearchParams(params.toString());
    sp.delete("entity_type");
    sp.delete("entity_id");
    router.replace(`?${sp.toString()}`, { scroll: false });
  }

  const label = ENTITY_LABEL[entityType] ?? entityType;
  return (
    <div className="border-primary/30 bg-primary/5 mt-4 flex items-center justify-between gap-3 rounded-md border px-4 py-2 text-sm">
      <p>
        Showing all changes to:{" "}
        <span className="font-medium">
          {label}{" "}
          <span className="font-mono text-xs">#{entityId.slice(0, 8)}</span>
        </span>
      </p>
      <button
        type="button"
        onClick={clear}
        className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
      >
        <X className="size-3.5" />
        Clear filter
      </button>
    </div>
  );
}
