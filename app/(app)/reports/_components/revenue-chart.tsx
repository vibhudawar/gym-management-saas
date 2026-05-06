"use client";

import { formatInTimeZone } from "date-fns-tz";
import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney, formatMoneyShort } from "@/lib/utils/money";
import { dateToIso } from "@/lib/utils/dates";
import {
  chooseAggregation,
  daysInRange,
  type DateRange,
} from "@/lib/utils/date-presets";
import type { RevenueReport } from "@/server/queries/reports/get-revenue-report";

type Props = {
  range: DateRange;
  daily: RevenueReport["daily"];
};

type ChartPoint = {
  bucket: string; // "Apr 14" / "Wk of Apr 14" / "Apr 2026"
  paymentsPaise: number;
  refundsPaise: number; // negative
  netPaise: number;
  cumulativePaise: number;
};

function startOfWeekIso(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0..6
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + offset);
  return dateToIso(d);
}

function startOfMonthIso(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/**
 * Aggregate daily rows into weekly or monthly buckets when the range gets
 * long. Keeps the chart legible at any reasonable horizon without exploding
 * to 365+ bars.
 */
function aggregate(daily: RevenueReport["daily"], range: DateRange): ChartPoint[] {
  // Daily rows are sorted desc; we want chronological for the chart.
  const sorted = [...daily].sort((a, b) => (a.date < b.date ? -1 : 1));
  const mode = chooseAggregation(range);

  let result: ChartPoint[];
  if (mode === "daily") {
    result = sorted.map((d) => ({
      bucket: formatInTimeZone(new Date(`${d.date}T00:00:00Z`), "UTC", "d MMM"),
      paymentsPaise: d.paymentsPaise,
      refundsPaise: d.refundsPaise,
      netPaise: d.netPaise,
      cumulativePaise: 0,
    }));
  } else {
    const buckets = new Map<string, ChartPoint>();
    for (const d of sorted) {
      const bucketKey =
        mode === "weekly" ? startOfWeekIso(d.date) : startOfMonthIso(d.date);
      const label =
        mode === "weekly"
          ? `Wk of ${formatInTimeZone(new Date(`${bucketKey}T00:00:00Z`), "UTC", "d MMM")}`
          : formatInTimeZone(
              new Date(`${bucketKey}T00:00:00Z`),
              "UTC",
              "MMM yyyy",
            );

      const existing = buckets.get(bucketKey);
      if (existing) {
        existing.paymentsPaise += d.paymentsPaise;
        existing.refundsPaise += d.refundsPaise;
        existing.netPaise += d.netPaise;
      } else {
        buckets.set(bucketKey, {
          bucket: label,
          paymentsPaise: d.paymentsPaise,
          refundsPaise: d.refundsPaise,
          netPaise: d.netPaise,
          cumulativePaise: 0,
        });
      }
    }
    result = Array.from(buckets.values());
  }

  // Running total — fold left over the chronological order.
  let running = 0;
  for (const p of result) {
    running += p.netPaise;
    p.cumulativePaise = running;
  }
  return result;
}

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
      <p className="text-foreground mb-1 font-medium">{p.bucket}</p>
      <p className="text-foreground">
        Net: <span className="tabular-nums font-medium">{formatMoney(p.netPaise)}</span>
      </p>
      <p className="text-muted-foreground">
        Paid: <span className="tabular-nums">{formatMoney(p.paymentsPaise)}</span>
      </p>
      {p.refundsPaise < 0 ? (
        <p className="text-destructive">
          Refund:{" "}
          <span className="tabular-nums">
            {formatMoney(Math.abs(p.refundsPaise))}
          </span>
        </p>
      ) : null}
      <p className="text-foreground/80 mt-1 border-t pt-1">
        Cumulative:{" "}
        <span className="tabular-nums">{formatMoney(p.cumulativePaise)}</span>
      </p>
    </div>
  );
}

export function RevenueChart({ range, daily }: Props) {
  const data = useMemo(() => aggregate(daily, range), [daily, range]);
  const totalDays = daysInRange(range);
  const aggregationLabel =
    chooseAggregation(range) === "daily"
      ? null
      : chooseAggregation(range) === "weekly"
        ? `Aggregated weekly (${totalDays} days)`
        : `Aggregated monthly (${totalDays} days)`;

  return (
    <div
      data-slot="card"
      className="bg-gradient-to-t from-primary/5 to-card text-card-foreground ring-foreground/10 dark:bg-card overflow-hidden rounded-xl ring-1 shadow-xs"
    >
      <div className="flex items-baseline justify-between gap-2 px-5 pt-4 pb-2">
        <div>
          <h2 className="text-foreground text-base font-semibold tracking-tight">
            {chooseAggregation(range) === "daily" ? "Daily revenue" : "Revenue"}
          </h2>
          {aggregationLabel ? (
            <p className="text-muted-foreground text-xs">{aggregationLabel}</p>
          ) : null}
        </div>
      </div>
      <div className="px-2 pb-3">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data} margin={{ top: 16, right: 50, left: 8, bottom: 8 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="bucket"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              minTickGap={20}
            />
            <YAxis
              yAxisId="left"
              tickFormatter={(v) => formatMoneyShort(Number(v))}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              width={50}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(v) => formatMoneyShort(Number(v))}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              width={50}
            />
            <Tooltip content={<Tip />} cursor={{ fill: "var(--muted)" }} />
            <Bar
              yAxisId="left"
              dataKey="netPaise"
              fill="var(--primary)"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
            <Line
              yAxisId="right"
              dataKey="cumulativePaise"
              stroke="var(--primary)"
              strokeOpacity={0.6}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
