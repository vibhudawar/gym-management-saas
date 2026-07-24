"use client";

import { useRouter } from "next/navigation";
import { formatPhoneForDisplay } from "@/lib/utils/phone";
import { cn } from "@/lib/utils";
import type { ActionRow as ActionRowType } from "@/server/queries/today/get-today-snapshot";
import { CallButton } from "./call-button";
import { ReminderIndicator } from "./reminder-indicator";
import { WhatsAppButton } from "./whatsapp-button";

type Props = {
  row: ActionRowType;
  kind: "expiring" | "expired";
  gymName: string;
  asOf: Date;
};

function daysLabel(kind: "expiring" | "expired", days: number): string {
  if (kind === "expiring") {
    if (days <= 0) return "Ends today";
    if (days === 1) return "Ends tomorrow";
    return `Ends in ${days} days`;
  }
  const lapsed = -days;
  if (lapsed === 0) return "Expired today";
  if (lapsed === 1) return "Expired yesterday";
  return `Expired ${lapsed} days ago`;
}

function daysClass(kind: "expiring" | "expired", days: number): string {
  if (kind === "expired") return "text-destructive";
  if (days <= 3) return "text-destructive";
  if (days <= 7) return "text-amber-700";
  return "text-foreground";
}

export function ActionRow({ row, kind, gymName, asOf }: Props) {
  const router = useRouter();

  function handleRowClick() {
    router.push(`/app/members/${row.memberId}`);
  }

  function stopPropagation(e: React.MouseEvent) {
    e.stopPropagation();
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleRowClick();
        }
      }}
      className="border-border hover:bg-muted/40 flex cursor-pointer items-start justify-between gap-3 border-b px-5 py-3 transition-colors last:border-0"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <p className="text-foreground text-sm font-medium">{row.memberName}</p>
          <p className="text-muted-foreground font-mono text-xs tabular-nums">
            {formatPhoneForDisplay(row.memberPhone)}
          </p>
        </div>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {row.planName} ·{" "}
          <span className={cn("font-medium", daysClass(kind, row.daysFromToday))}>
            {daysLabel(kind, row.daysFromToday)}
          </span>
        </p>
        <div className="mt-1">
          <ReminderIndicator
            sentAt={row.latestReminder?.sentAt ?? null}
            asOf={asOf}
          />
        </div>
      </div>
      <div
        className="flex shrink-0 items-center gap-1.5"
        onClick={stopPropagation}
      >
        <WhatsAppButton
          kind={kind === "expiring" ? "expiring" : "expired"}
          memberId={row.memberId}
          membershipId={row.membershipId}
          memberName={row.memberName}
          memberPhone={row.memberPhone}
          planName={row.planName}
          endDate={row.endDate}
          daysFromToday={row.daysFromToday}
          gymName={gymName}
          branchName={row.branchName}
        />
        <CallButton phoneE164={row.memberPhone} />
      </div>
    </div>
  );
}
