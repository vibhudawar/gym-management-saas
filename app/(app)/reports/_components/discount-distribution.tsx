"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import type { DiscountLeakageReport } from "@/server/queries/reports/get-discount-leakage-report";

type Props = {
  rows: DiscountLeakageReport["distribution"];
};

export function DiscountDistribution({ rows }: Props) {
  if (rows.length === 0) return null;
  const total = rows.reduce((acc, r) => acc + r.count, 0);
  if (total === 0) return null;

  return (
    <section
      data-slot="card"
      className="bg-gradient-to-t from-primary/5 to-card text-card-foreground ring-foreground/10 dark:bg-card overflow-hidden rounded-xl ring-1 shadow-xs"
    >
      <header className="px-5 pt-4 pb-2">
        <h2 className="text-foreground text-base font-semibold tracking-tight">
          Discount distribution
        </h2>
        <p className="text-muted-foreground text-xs">
          Number of memberships per discount size
        </p>
      </header>
      <div className="px-2 pb-3">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart
            data={rows}
            margin={{ top: 8, right: 16, left: 8, bottom: 4 }}
          >
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              width={32}
            />
            <Bar
              dataKey="count"
              fill="var(--primary)"
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            />
          </BarChart>
        </ResponsiveContainer>
        <div className="text-muted-foreground grid grid-cols-5 px-4 text-center text-[10px]">
          {rows.map((r) => (
            <span key={r.key}>
              {r.count} {r.count === 1 ? "disc." : "disc."}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
