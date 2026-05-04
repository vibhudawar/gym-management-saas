"use client";

import { ArrowRight, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ROLE_LABEL, type Role } from "@/lib/auth/roles";
import { formatDateTime, formatRelative } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";
import type { AuditEntry } from "@/server/queries/audit-log/list-audit-entries";
import { JsonBlock } from "./json-block";

type Props = {
  entry: AuditEntry;
};

const ACTION_TONE: Record<string, string> = {
  create: "bg-muted-foreground/40",
  update: "bg-primary",
  correction: "bg-amber-500",
  cancel: "bg-amber-500",
  cancel_early: "bg-amber-500",
  delete: "bg-destructive",
  refund: "bg-destructive",
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

const ACTION_VERB: Record<string, string> = {
  create: "created",
  update: "updated",
  correction: "corrected",
  cancel: "cancelled",
  cancel_early: "cancelled early",
  delete: "deleted",
  refund: "refunded",
};

function entityLink(entityType: string, entityId: string): string | null {
  switch (entityType) {
    case "member":
      return `/members/${entityId}`;
    case "membership":
    case "freeze":
    case "payment":
      // No dedicated route; navigate to the audit log filtered to this entity
      // so the user can see the full history.
      return null;
    case "plan":
    case "addon":
      return "/plans";
    default:
      return null;
  }
}

export function AuditEntryRow({ entry }: Props) {
  const [open, setOpen] = useState(false);
  const dot = ACTION_TONE[entry.action] ?? "bg-muted-foreground/40";
  const headline = `${ENTITY_LABEL[entry.entityType] ?? entry.entityType} ${
    ACTION_VERB[entry.action] ?? entry.action
  }`;
  const link = entityLink(entry.entityType, entry.entityId);

  return (
    <li className="border-b last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="hover:bg-muted/30 flex w-full items-start gap-3 px-5 py-3 text-left transition-colors"
      >
        <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", dot)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-foreground text-sm font-medium">{headline}</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-muted-foreground text-xs">
                  {formatRelative(entry.createdAt)}
                </span>
              </TooltipTrigger>
              <TooltipContent>{formatDateTime(entry.createdAt)}</TooltipContent>
            </Tooltip>
          </div>
          <p className="text-foreground/80 mt-0.5 truncate text-xs">
            {entry.entityLabel}
          </p>
          <p className="text-muted-foreground text-[11px]">
            {entry.user.name ?? "(removed user)"}
            {entry.user.role
              ? ` (${ROLE_LABEL[entry.user.role as Role]})`
              : null}
            {entry.branchName ? ` · ${entry.branchName}` : ""}
          </p>
        </div>
        {open ? (
          <ChevronDown className="text-muted-foreground mt-1 size-4 shrink-0" />
        ) : (
          <ChevronRight className="text-muted-foreground mt-1 size-4 shrink-0" />
        )}
      </button>
      {open ? (
        <div className="bg-muted/20 space-y-3 px-5 pb-4 pt-1 text-sm">
          {(() => {
            const reason = extractReason(entry.afterJson, entry.beforeJson);
            if (!reason) return null;
            return (
              <p className="border-l-primary/40 text-foreground/90 border-l-2 pl-3 text-xs italic">
                Reason: &ldquo;{reason}&rdquo;
              </p>
            );
          })()}
          <div className="grid gap-3 md:grid-cols-2">
            <JsonBlock label="Before" value={entry.beforeJson} />
            <JsonBlock label="After" value={entry.afterJson} />
          </div>
          <div className="text-primary flex flex-wrap gap-3 text-xs">
            {link ? (
              <Link href={link} className="inline-flex items-center gap-1 hover:underline">
                View this {ENTITY_LABEL[entry.entityType]?.toLowerCase() ?? entry.entityType}
                <ArrowRight className="size-3" />
              </Link>
            ) : null}
            <Link
              href={`/audit-log?entity_type=${entry.entityType}&entity_id=${entry.entityId}`}
              className="inline-flex items-center gap-1 hover:underline"
            >
              All changes to this entity
              <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      ) : null}
    </li>
  );
}

/**
 * Audits don't have a dedicated reason column — reasons live inside the
 * before/after JSON depending on the action (correction, cancellation,
 * refund, edit-payment all snapshot a `reason` or similar field). Pull it
 * out for the prominent quote when present.
 */
function extractReason(after: unknown, before: unknown): string | null {
  for (const blob of [after, before]) {
    if (!blob || typeof blob !== "object") continue;
    const obj = blob as Record<string, unknown>;
    const meta = obj._meta as Record<string, unknown> | undefined;
    const candidates = [
      typeof obj.reason === "string" ? obj.reason : null,
      typeof obj.discountReason === "string" ? obj.discountReason : null,
      typeof obj.cancellationReason === "string" ? obj.cancellationReason : null,
      typeof obj.earlyUnfreezeReason === "string" ? obj.earlyUnfreezeReason : null,
      meta && typeof meta.reason === "string" ? meta.reason : null,
      meta && typeof meta.earlyUnfreezeReason === "string"
        ? meta.earlyUnfreezeReason
        : null,
    ];
    for (const c of candidates) {
      if (c && c.trim().length > 0) return c.trim();
    }
  }
  return null;
}
