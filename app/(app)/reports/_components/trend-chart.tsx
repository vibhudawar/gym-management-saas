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

type Props = {
  current: Array<{ date: string; netPaise: number }>;
  prior: Array<{ date: string; netPaise: number }> | null;
};

type Point = {
  /** Index 1-based for the X axis label ("day 1 of period"). */
  dayIndex: number;
  /** Calendar date this index represents in the *current* period. */
  currentDate: string | null;
  currentPaise: number | null;
  /** Calendar date this index represents in the *prior* period. */
  priorDate: string | null;
  priorPaise: number | null;
};

type TooltipPayload = Array<{ payload: Point }>;

function formatDay(iso: string | null): string {
  if (!iso) return "—";
  return formatInTimeZone(new Date(`${iso}T00:00:00Z`), "UTC", "d MMM");
}

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
      {p.currentDate ? (
        <p className="text-foreground">
          <span className="font-medium">{formatDay(p.currentDate)}</span>:{" "}
          <span className="tabular-nums">
            {formatMoney(p.currentPaise ?? 0)}
          </span>
        </p>
      ) : null}
      {p.priorDate !== null ? (
        <p className="text-muted-foreground">
          {formatDay(p.priorDate)}:{" "}
          <span className="tabular-nums">{formatMoney(p.priorPaise ?? 0)}</span>{" "}
          (prior)
        </p>
      ) : null}
    </div>
  );
}

/**
 * Index-aligned current vs prior overlay. We zip on day-index rather than
 * date, so e.g. "day 5 of this month" sits on top of "day 5 of last month"
 * even when months have different lengths.
 */
export function TrendChart({ current, prior }: Props) {
  const data = useMemo<Point[]>(() => {
    const len = Math.max(current.length, prior?.length ?? 0);
    const points: Point[] = [];
    for (let i = 0; i < len; i++) {
      const cur = current[i];
      const pr = prior?.[i];
      points.push({
        dayIndex: i + 1,
        currentDate: cur?.date ?? null,
        currentPaise: cur ? cur.netPaise : null,
        priorDate: pr?.date ?? null,
        priorPaise: pr ? pr.netPaise : null,
      });
    }
    return points;
  }, [current, prior]);

  return (
    <section
      data-slot="card"
      className="bg-gradient-to-t from-primary/5 to-card text-card-foreground ring-foreground/10 dark:bg-card overflow-hidden rounded-xl ring-1 shadow-xs"
    >
      <header className="flex items-baseline justify-between gap-2 px-5 pt-4 pb-2">
        <div>
          <h2 className="text-foreground text-base font-semibold tracking-tight">
            Revenue this period vs last period
          </h2>
          <p className="text-muted-foreground text-xs">
            <span className="text-primary mr-1">●</span>This period
            {prior ? (
              <>
                <span className="text-muted-foreground/60 ml-3 mr-1">●</span>
                Last period
              </>
            ) : null}
          </p>
        </div>
      </header>
      <div className="px-2 pb-3">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data} margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="dayIndex"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              minTickGap={20}
              tickFormatter={(v) => `D${v}`}
            />
            <YAxis
              tickFormatter={(v) => formatMoneyShort(Number(v))}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              width={50}
            />
            <Tooltip content={<Tip />} cursor={{ fill: "var(--muted)" }} />
            {prior ? (
              <Line
                dataKey="priorPaise"
                stroke="var(--muted-foreground)"
                strokeWidth={1.5}
                strokeOpacity={0.45}
                dot={false}
                isAnimationActive={false}
              />
            ) : null}
            <Bar
              dataKey="currentPaise"
              fill="var(--primary)"
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
