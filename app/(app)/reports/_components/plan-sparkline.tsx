"use client";

import { Bar, BarChart, Cell, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

type Props = {
  weeklyCounts: number[];
  className?: string;
};

/**
 * Tiny inline trend bars for a plan's row. ~80px wide. Last bucket renders in
 * --primary, prior buckets in --muted-foreground. Caller must guarantee the
 * wrapper width so the table layout doesn't reflow.
 */
export function PlanSparkline({ weeklyCounts, className }: Props) {
  if (weeklyCounts.length < 2) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  const data = weeklyCounts.map((count, i) => ({ idx: i, count }));
  const lastIdx = weeklyCounts.length - 1;

  return (
    <div className={cn("h-6 w-20", className)}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Bar dataKey="count" radius={[2, 2, 0, 0]} minPointSize={1}>
            {data.map((d) => (
              <Cell
                key={d.idx}
                fill={d.idx === lastIdx ? "var(--primary)" : "var(--muted-foreground)"}
                fillOpacity={d.idx === lastIdx ? 1 : 0.5}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
