"use client";

import { History } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDateTime } from "@/lib/utils/dates";

type Props = {
  correctedAt: Date | string;
  correctedByName: string | null;
  level: "receptionist" | "manager" | "owner" | null;
  reason: string | null;
  before:
    | {
        planName: string | null;
        finalAmountPaise: number;
      }
    | null;
  correctionCount?: number;
  canViewAll?: boolean;
};

const LEVEL_LABEL: Record<NonNullable<Props["level"]>, string> = {
  receptionist: "Receptionist",
  manager: "Branch Manager",
  owner: "Owner",
};

export function CorrectionMarker({
  correctedAt,
  correctedByName,
  level,
  reason,
  before,
  correctionCount = 1,
  canViewAll = false,
}: Props) {
  const showCount = correctionCount > 1;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs italic"
        >
          <History className="size-3" />
          Corrected{" "}
          {correctedByName ? `by ${correctedByName}` : ""} on{" "}
          {formatDateTime(correctedAt)}
          {showCount ? ` (${correctionCount} corrections)` : ""}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-xs" align="start">
        <p className="text-foreground mb-2 font-medium">Correction details</p>
        <p className="text-muted-foreground">
          On {formatDateTime(correctedAt)}
          {correctedByName ? ` by ${correctedByName}` : ""}
          {level ? ` (${LEVEL_LABEL[level]})` : ""}.
        </p>
        {reason ? (
          <p className="text-foreground mt-2 whitespace-pre-wrap">
            {reason}
          </p>
        ) : null}
        {before ? (
          <div className="border-border mt-3 space-y-1 border-t pt-3">
            <p className="text-foreground font-medium">Original values</p>
            {before.planName ? (
              <p className="text-muted-foreground">
                Plan:{" "}
                <span className="text-foreground">{before.planName}</span>
              </p>
            ) : null}
            <p className="text-muted-foreground">
              Final amount:{" "}
              <span className="text-foreground">
                ₹{(before.finalAmountPaise / 100).toLocaleString("en-IN")}
              </span>
            </p>
          </div>
        ) : null}
        {canViewAll && showCount ? (
          <div className="border-border mt-3 border-t pt-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <button
                    type="button"
                    disabled
                    className="text-muted-foreground/70 cursor-not-allowed text-xs underline-offset-2 hover:underline"
                  >
                    View all {correctionCount} corrections →
                  </button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Coming with Audit Log module</TooltipContent>
            </Tooltip>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
