"use client";

import { ArrowUpRight, Phone, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EXPIRING_ROWS, SHOWCASE_METRICS } from "./landing-data";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
}

// Shared window chrome bar.
function Chrome({ dot = "size-3.5" }: { dot?: string }) {
  return (
    <div className="flex h-11 items-center gap-2 border-b border-border bg-muted/40 px-4 sm:h-14 sm:gap-2.5 sm:px-6">
      <span className={`${dot} rounded-full bg-red-400/70`} />
      <span className={`${dot} rounded-full bg-amber-400/70`} />
      <span className={`${dot} rounded-full bg-emerald-400/70`} />
      <div className="mx-auto flex items-center gap-2 rounded-md bg-background/70 px-3 py-1 text-xs text-muted-foreground sm:px-4 sm:py-1.5 sm:text-sm">
        <span className="size-1.5 rounded-full bg-emerald-500 sm:size-2" />
        app.gymos — Today
      </div>
    </div>
  );
}

// ── Desktop: authored at a real 1920×1080 canvas, scaled uniformly to fit
// the container so it reads like an actual full-HD screenshot. ────────────
const CANVAS_W = 1920;
const CANVAS_H = 1080;

export function AppScreen() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1400 / CANVAS_W);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      if (width > 0) setScale(width / CANVAS_W);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      className="w-full overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-primary/10"
      style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
    >
      <div
        className="origin-top-left"
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          transform: `scale(${scale})`,
        }}
      >
        <Chrome />

        <div
          className="flex flex-col gap-8 p-12"
          style={{ height: CANVAS_H - 56 }}
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-3xl font-semibold tracking-tight text-foreground">
                Today
              </h3>
              <p className="mt-1.5 text-lg text-muted-foreground">
                Thursday, 24 July 2026
              </p>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/40 px-5 py-3 text-lg text-muted-foreground">
              <Search className="size-5" />
              Search members…
            </div>
          </div>

          <div className="grid grid-cols-4 gap-6">
            {SHOWCASE_METRICS.map((m) => (
              <div
                key={m.label}
                className="rounded-2xl border border-border bg-gradient-to-t from-primary/5 to-card p-7 shadow-xs"
              >
                <p className="text-lg font-medium text-muted-foreground">
                  {m.label}
                </p>
                <p className="mt-3 text-[44px] font-semibold leading-none tabular-nums tracking-tight text-foreground">
                  {m.value}
                </p>
                <p
                  className={
                    m.positive
                      ? "mt-3 text-lg font-medium text-emerald-600"
                      : "mt-3 text-lg font-medium text-amber-600"
                  }
                >
                  {m.delta}
                </p>
              </div>
            ))}
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-7 py-5">
              <h4 className="text-xl font-semibold text-foreground">
                Expiring soon
              </h4>
              <span className="text-lg text-muted-foreground">23 members</span>
            </div>
            <ul className="flex-1 divide-y divide-border">
              {EXPIRING_ROWS.map((row) => (
                <li key={row.name} className="flex items-center gap-4 px-7 py-5">
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-semibold text-muted-foreground">
                    {initials(row.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xl font-medium text-foreground">
                      {row.name}
                    </p>
                    <p className="truncate text-lg text-muted-foreground">
                      {row.plan}
                    </p>
                  </div>
                  <span
                    className={
                      row.tone === "danger"
                        ? "rounded-full bg-red-50 px-4 py-2 text-base font-medium text-red-700"
                        : "rounded-full bg-amber-50 px-4 py-2 text-base font-medium text-amber-700"
                    }
                  >
                    expires {row.expires}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-base font-medium text-primary-foreground">
                    <ArrowUpRight className="size-5" />
                    WhatsApp
                  </span>
                  <span className="inline-flex items-center justify-center rounded-xl border border-border bg-background p-3 text-muted-foreground">
                    <Phone className="size-5" />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mobile / tablet: a natural-flow, readable dashboard (not scaled). ──────
export function AppScreenCompact() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-primary/10">
      <Chrome dot="size-2.5" />
      <div className="p-4">
        <div className="mb-4">
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            Today
          </h3>
          <p className="text-xs text-muted-foreground">Thursday, 24 July 2026</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {SHOWCASE_METRICS.map((m) => (
            <div
              key={m.label}
              className="rounded-xl border border-border bg-gradient-to-t from-primary/5 to-card p-3.5 shadow-xs"
            >
              <p className="text-[11px] font-medium text-muted-foreground">
                {m.label}
              </p>
              <p className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight text-foreground">
                {m.value}
              </p>
              <p
                className={
                  m.positive
                    ? "mt-0.5 text-[11px] font-medium text-emerald-600"
                    : "mt-0.5 text-[11px] font-medium text-amber-600"
                }
              >
                {m.delta}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-border">
          <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
            <h4 className="text-sm font-semibold text-foreground">
              Expiring soon
            </h4>
            <span className="text-[11px] text-muted-foreground">23 members</span>
          </div>
          <ul className="divide-y divide-border">
            {EXPIRING_ROWS.slice(0, 4).map((row) => (
              <li key={row.name} className="flex items-center gap-3 px-3.5 py-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                  {initials(row.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {row.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.plan}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground">
                  <ArrowUpRight className="size-3.5" />
                  WhatsApp
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
