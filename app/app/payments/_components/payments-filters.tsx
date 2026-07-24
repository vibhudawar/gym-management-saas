"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { paymentModes } from "@/lib/db/schema/payments";

type Branch = { id: string; name: string };

type Props = {
  branches: Branch[];
  showBranchFilter: boolean;
};

export function PaymentsFilters({ branches, showBranchFilter }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const dateFrom = searchParams.get("from") ?? "";
  const dateTo = searchParams.get("to") ?? "";
  const branchId = searchParams.get("branch") ?? "all";
  const mode = searchParams.get("mode") ?? "all";
  const kind = searchParams.get("kind") ?? "all";

  function pushParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    params.delete("page");
    const nextQuery = params.toString();
    if (nextQuery === searchParams.toString()) return;
    router.replace(nextQuery ? `/payments?${nextQuery}` : "/payments");
  }

  return (
    <div className="bg-background sticky top-14 z-20 flex flex-wrap items-end gap-3 border-b py-3">
      <div className="space-y-1">
        <Label htmlFor="from" className="text-xs">From</Label>
        <Input
          id="from"
          type="date"
          value={dateFrom}
          onChange={(e) =>
            pushParams((p) => {
              const v = e.currentTarget.value;
              if (v) p.set("from", v);
              else p.delete("from");
            })
          }
          className="w-40"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="to" className="text-xs">To</Label>
        <Input
          id="to"
          type="date"
          value={dateTo}
          onChange={(e) =>
            pushParams((p) => {
              const v = e.currentTarget.value;
              if (v) p.set("to", v);
              else p.delete("to");
            })
          }
          className="w-40"
        />
      </div>

      {showBranchFilter ? (
        <div className="space-y-1">
          <Label className="text-xs">Branch</Label>
          <Select
            value={branchId}
            onValueChange={(v) =>
              pushParams((p) => {
                if (v === "all") p.delete("branch");
                else p.set("branch", v);
              })
            }
          >
            <SelectTrigger className="w-[180px]">
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
        </div>
      ) : null}

      <div className="space-y-1">
        <Label className="text-xs">Mode</Label>
        <Select
          value={mode}
          onValueChange={(v) =>
            pushParams((p) => {
              if (v === "all") p.delete("mode");
              else p.set("mode", v);
            })
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modes</SelectItem>
            {paymentModes.map((m) => (
              <SelectItem key={m} value={m}>
                {m === "bank_transfer" ? "Bank" : m.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Kind</Label>
        <Tabs
          value={kind}
          onValueChange={(v) =>
            pushParams((p) => {
              if (v === "all") p.delete("kind");
              else p.set("kind", v);
            })
          }
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="payment">Payments</TabsTrigger>
            <TabsTrigger value="refund">Refunds</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}
