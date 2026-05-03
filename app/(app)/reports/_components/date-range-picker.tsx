"use client";

import { CalendarIcon, ChevronDown } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DATE_PRESETS,
  formatRangeLabel,
  inferPreset,
  isValidDateRange,
  resolvePreset,
  type DatePresetKey,
  type DateRange,
} from "@/lib/utils/date-presets";
import { cn } from "@/lib/utils";

type Props = {
  range: DateRange;
};

/**
 * Filter trigger that pushes its picked range into the URL via `?from` /
 * `?to`. The popover lists preset keys plus a custom-range section with
 * two date inputs.
 */
export function DateRangePicker({ range }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  const activePreset = useMemo(() => inferPreset(range), [range]);
  const [customFrom, setCustomFrom] = useState(range.from);
  const [customTo, setCustomTo] = useState(range.to);

  function commit(next: DateRange) {
    const sp = new URLSearchParams(params.toString());
    sp.set("from", next.from);
    sp.set("to", next.to);
    setOpen(false);
    startTransition(() => {
      router.replace(`?${sp.toString()}`, { scroll: false });
    });
  }

  function pickPreset(key: Exclude<DatePresetKey, "custom">) {
    commit(resolvePreset(key));
  }

  function applyCustom() {
    const candidate: DateRange = { from: customFrom, to: customTo };
    if (!isValidDateRange(candidate)) return;
    commit(candidate);
  }

  const triggerLabel =
    activePreset === "custom"
      ? formatRangeLabel(range)
      : (DATE_PRESETS.find((p) => p.key === activePreset)?.label ??
        formatRangeLabel(range));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <CalendarIcon className="size-3.5" />
          <span>{triggerLabel}</span>
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <ul className="py-1">
          {DATE_PRESETS.map((p) => (
            <li key={p.key}>
              <button
                type="button"
                onClick={() => pickPreset(p.key)}
                className={cn(
                  "hover:bg-muted/50 flex w-full items-center justify-between px-3 py-1.5 text-sm",
                  activePreset === p.key && "bg-muted/40 font-medium",
                )}
              >
                <span>{p.label}</span>
                <span className="text-muted-foreground text-xs">
                  {formatRangeLabel(resolvePreset(p.key))}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="border-border space-y-2 border-t p-3">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Custom range
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="range-from" className="text-xs">
                From
              </Label>
              <Input
                id="range-from"
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.currentTarget.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="range-to" className="text-xs">
                To
              </Label>
              <Input
                id="range-to"
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.currentTarget.value)}
              />
            </div>
          </div>
          {customFrom > customTo ? (
            <p className="text-destructive text-xs">
              From date must be before to date.
            </p>
          ) : null}
          <Button
            type="button"
            size="sm"
            className="w-full"
            disabled={customFrom > customTo}
            onClick={applyCustom}
          >
            Apply custom range
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
