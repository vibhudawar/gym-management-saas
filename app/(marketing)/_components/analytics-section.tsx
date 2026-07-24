import { AlertTriangle, TrendingUp } from "lucide-react";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

const BARS = [38, 44, 41, 52, 49, 63, 58, 72];
const MONTHS = ["Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];

function RevenueChart() {
  const width = 460;
  const height = 200;
  const pad = { top: 16, right: 12, bottom: 24, left: 12 };
  const max = 80;
  const n = BARS.length;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const slot = innerW / n;
  const barW = slot * 0.5;

  const points = BARS.map((v, i) => {
    const x = pad.left + slot * i + slot / 2;
    const y = pad.top + innerH - (v / max) * innerH;
    return [x, y] as const;
  });
  const line = points.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label="Monthly revenue trending upward"
    >
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <line
          key={g}
          x1={pad.left}
          x2={width - pad.right}
          y1={pad.top + innerH - g * innerH}
          y2={pad.top + innerH - g * innerH}
          stroke="var(--border)"
          strokeWidth="1"
        />
      ))}
      {BARS.map((v, i) => {
        const x = pad.left + slot * i + (slot - barW) / 2;
        const h = (v / max) * innerH;
        const y = pad.top + innerH - h;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={h}
            rx="4"
            fill="var(--primary)"
            opacity={i === n - 1 ? 1 : 0.18}
          />
        );
      })}
      <path
        d={line}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="var(--primary)" />
      ))}
      {MONTHS.map((m, i) => (
        <text
          key={m}
          x={pad.left + slot * i + slot / 2}
          y={height - 6}
          textAnchor="middle"
          fontSize="10"
          fill="var(--muted-foreground)"
        >
          {m}
        </text>
      ))}
    </svg>
  );
}

export function AnalyticsSection() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-6">
        <SectionHeading
          eyebrow="Reports"
          title="Reports that tell you what to do next"
          subtitle="Two focused charts and clear numbers — no dashboards you'll never open."
        />

        <div className="mt-14 grid items-stretch gap-5 lg:grid-cols-5">
          <Reveal className="lg:col-span-3">
            <div className="h-full rounded-2xl border border-border bg-card p-6 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Revenue
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                    ₹5,84,200
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  <TrendingUp className="size-3.5" />
                  +18% MoM
                </span>
              </div>
              <div className="mt-5">
                <RevenueChart />
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.08} className="lg:col-span-2">
            <div className="flex h-full flex-col justify-between rounded-2xl border border-red-200 bg-red-50/50 p-6 shadow-xs">
              <div>
                <span className="flex size-10 items-center justify-center rounded-xl bg-red-100 text-red-600">
                  <AlertTriangle className="size-5" />
                </span>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-red-600">
                  Anomaly detected
                </p>
                <h3 className="mt-2 text-lg font-semibold text-foreground">
                  Discount leakage is 3× the monthly average
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Driven by 4 receptionists exceeding 20% off this week. GymOS
                  flags it before it becomes a habit — and shows you exactly who
                  and how much.
                </p>
              </div>
              <p className="mt-6 text-sm font-medium text-foreground">
                ₹41,300 given away this month →
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
