"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { DateRange } from "@/lib/utils/date-presets";
import { DateRangePicker } from "./date-range-picker";

export type ReportTab = "overview" | "revenue" | "plans" | "discounts";

type Props = {
  range: DateRange;
  activeTab: ReportTab;
};

export function ReportFilters({ range, activeTab }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function pickTab(next: string) {
    if (next === activeTab) return;
    const sp = new URLSearchParams(params.toString());
    sp.set("tab", next);
    startTransition(() => {
      router.replace(`?${sp.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="bg-background sticky top-0 z-20 flex flex-col gap-3 border-b py-3 sm:flex-row sm:items-center sm:justify-between">
      <Tabs value={activeTab} onValueChange={pickTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="discounts">Discounts</TabsTrigger>
        </TabsList>
      </Tabs>
      <DateRangePicker range={range} />
    </div>
  );
}
