"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DateRange } from "@/lib/utils/date-presets";
import { ROLE_LABEL, type Role } from "@/lib/auth/roles";
import { DateRangePicker } from "@/app/app/reports/_components/date-range-picker";

type Props = {
  range: DateRange;
  entityType: string | null;
  action: string | null;
  userId: string | null;
  entityTypes: string[];
  actions: string[];
  users: Array<{ id: string; name: string; role: Role; entryCount: number }>;
};

const ENTITY_LABEL_FALLBACK: Record<string, string> = {
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

const ACTION_LABEL_FALLBACK: Record<string, string> = {
  create: "Create",
  update: "Update",
  correction: "Correction",
  cancel: "Cancel",
  cancel_early: "Cancel early",
  delete: "Delete",
  refund: "Refund",
};

const SENTINEL_ALL = "__all__";

export function AuditFilters({
  range,
  entityType,
  action,
  userId,
  entityTypes,
  actions,
  users,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function pushParam(key: string, value: string | null) {
    const sp = new URLSearchParams(params.toString());
    if (value && value !== SENTINEL_ALL) sp.set(key, value);
    else sp.delete(key);
    sp.delete("page");
    startTransition(() => {
      router.replace(`?${sp.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="bg-background sticky top-0 z-20 flex flex-col gap-3 border-b py-3 sm:flex-row sm:flex-wrap sm:items-center">
      <DateRangePicker range={range} />
      <Select
        value={entityType ?? SENTINEL_ALL}
        onValueChange={(v) => pushParam("entity_type", v)}
      >
        <SelectTrigger size="sm" className="min-w-[150px]">
          <SelectValue placeholder="All entities" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SENTINEL_ALL}>All entities</SelectItem>
          {entityTypes.map((t) => (
            <SelectItem key={t} value={t}>
              {ENTITY_LABEL_FALLBACK[t] ?? t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={action ?? SENTINEL_ALL}
        onValueChange={(v) => pushParam("action", v)}
      >
        <SelectTrigger size="sm" className="min-w-[150px]">
          <SelectValue placeholder="All actions" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SENTINEL_ALL}>All actions</SelectItem>
          {actions.map((a) => (
            <SelectItem key={a} value={a}>
              {ACTION_LABEL_FALLBACK[a] ?? a}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {users.length > 0 ? (
        <Select
          value={userId ?? SENTINEL_ALL}
          onValueChange={(v) => pushParam("user_id", v)}
        >
          <SelectTrigger size="sm" className="min-w-[180px]">
            <SelectValue placeholder="All staff" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SENTINEL_ALL}>All staff</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name} — {ROLE_LABEL[u.role]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}
