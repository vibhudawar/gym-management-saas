"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney, formatMoneyShort } from "@/lib/utils/money";
import type { PlanWiseReport } from "@/server/queries/reports/get-plan-wise-report";

type Props = {
  rows: PlanWiseReport["rows"];
};

type ChartPoint = {
  planId: string;
  planName: string;
  netPaise: number;
  sold: number;
  isActive: boolean;
};

type TooltipPayload = Array<{ payload: ChartPoint }>;

function Tip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-popover text-popover-foreground rounded-md border px-3 py-2 text-xs shadow-md">
      <p className="text-foreground mb-1 font-medium">{p.planName}</p>
      <p className="text-foreground tabular-nums">
        {formatMoney(p.netPaise)} net
      </p>
      <p className="text-muted-foreground">
        {p.sold} {p.sold === 1 ? "sale" : "sales"}
      </p>
    </div>
  );
}

export function PlanWiseChart({ rows }: Props) {
  // Filter out plans with zero sales — sorted by query already (net desc).
  const data: ChartPoint[] = rows
    .filter((r) => r.sold > 0)
    .map((r) => ({
      planId: r.planId,
      planName: r.planName,
      netPaise: r.netPaise,
      sold: r.sold,
      isActive: r.isActive,
    }));

  if (data.length === 0) return null;

  const height = Math.max(120, data.length * 56 + 32);

  return (
    <div
      data-slot="card"
      className="bg-gradient-to-t from-primary/5 to-card text-card-foreground ring-foreground/10 dark:bg-card overflow-hidden rounded-xl ring-1 shadow-xs"
    >
      <header className="px-5 pt-4 pb-2">
        <h2 className="text-foreground text-base font-semibold tracking-tight">
          Revenue by plan
        </h2>
        <p className="text-muted-foreground text-xs">
          Sorted by net revenue
        </p>
      </header>
      <div className="px-2 pb-3">
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 8, right: 96, left: 8, bottom: 8 }}
          >
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={(v) => formatMoneyShort(Number(v))}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />
            <YAxis
              type="category"
              dataKey="planName"
              width={120}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: "var(--foreground)" }}
            />
            <Tooltip content={<Tip />} cursor={{ fill: "var(--muted)" }} />
            <Bar dataKey="netPaise" radius={[0, 4, 4, 0]} maxBarSize={32}>
              {data.map((entry) => (
                <Cell
                  key={entry.planId}
                  fill={
                    entry.isActive ? "var(--primary)" : "var(--muted-foreground)"
                  }
                  fillOpacity={entry.isActive ? 1 : 0.5}
                />
              ))}
              <LabelList
                dataKey="netPaise"
                position="right"
                content={({ x, y, width, height: h, value, index }) => {
                  if (typeof index !== "number") return null;
                  const item = data[index];
                  if (!item) return null;
                  const cx =
                    (typeof x === "number" ? x : 0) +
                    (typeof width === "number" ? width : 0) +
                    8;
                  const cy =
                    (typeof y === "number" ? y : 0) +
                    (typeof h === "number" ? h : 0) / 2 +
                    4;
                  return (
                    <text
                      x={cx}
                      y={cy}
                      fontSize={11}
                      fill="var(--foreground)"
                    >
                      {formatMoneyShort(Number(value) || 0)}
                      <tspan fill="var(--muted-foreground)">
                        {" "}({item.sold})
                      </tspan>
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
