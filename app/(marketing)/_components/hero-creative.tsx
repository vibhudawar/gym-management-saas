import {
  AlertTriangle,
  CalendarClock,
  IndianRupee,
  ListChecks,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Source = { icon: LucideIcon; name: string; meta: string };
const SOURCES: ReadonlyArray<Source> = [
  { icon: Users, name: "Members", meta: "1,284 active" },
  { icon: IndianRupee, name: "Payments", meta: "₹4.2L this month" },
  { icon: ListChecks, name: "Plans & add-ons", meta: "12 active plans" },
  { icon: RefreshCw, name: "Renewals", meta: "tracked daily" },
];

type Alert = {
  icon: LucideIcon;
  title: string;
  text: string;
  severity: string;
  tone: "danger" | "warn" | "success";
};
const ALERTS: ReadonlyArray<Alert> = [
  {
    icon: CalendarClock,
    title: "Renewal due",
    text: "Rohan Mehta's plan expires in 3 days. Send a WhatsApp reminder.",
    severity: "Renewal due",
    tone: "warn",
  },
  {
    icon: AlertTriangle,
    title: "Revenue anomaly",
    text: "Discount leakage is 3× the monthly average this week.",
    severity: "Review",
    tone: "danger",
  },
  {
    icon: Sparkles,
    title: "Win-back signal",
    text: "18 lapsed members haven't returned in 30+ days.",
    severity: "Win-back",
    tone: "success",
  },
];

const TONE: Record<
  Alert["tone"],
  { left: string; chip: string; badge: string }
> = {
  danger: {
    left: "border-l-red-400",
    chip: "bg-red-50 text-red-600",
    badge: "bg-red-100 text-red-700",
  },
  warn: {
    left: "border-l-amber-400",
    chip: "bg-amber-50 text-amber-600",
    badge: "bg-amber-100 text-amber-700",
  },
  success: {
    left: "border-l-emerald-400",
    chip: "bg-emerald-50 text-emerald-600",
    badge: "bg-emerald-100 text-emerald-700",
  },
};

export function HeroCreative() {
  return (
    <div className="rounded-2xl border border-border bg-muted/20 p-4 sm:p-6">
      <style>{`
        @keyframes hcPulse { 0% { transform: scale(1); opacity: .5 } 70% { opacity: 0 } 100% { transform: scale(1.55); opacity: 0 } }
        @keyframes hcSpin { to { transform: rotate(360deg) } }
        @keyframes hcSpot {
          0%   { opacity: .42; transform: scale(.95); box-shadow: 0 0 #0000; z-index: 10 }
          4%   { opacity: 1;   transform: scale(1);    box-shadow: 0 16px 32px -14px rgba(2,6,23,.28); z-index: 20 }
          29%  { opacity: 1;   transform: scale(1);    box-shadow: 0 16px 32px -14px rgba(2,6,23,.28); z-index: 20 }
          34%  { opacity: .42; transform: scale(.95); box-shadow: 0 0 #0000; z-index: 10 }
          100% { opacity: .42; transform: scale(.95); box-shadow: 0 0 #0000; z-index: 10 }
        }
        .hc-ring { animation: hcPulse 3s ease-out infinite }
        .hc-ring.delay { animation-delay: 1.5s }
        .hc-spin { animation: hcSpin 7s linear infinite }
        .hc-alert { animation: hcSpot 9s ease-in-out infinite }
        .hc-alert.a1 { animation-delay: -4.5s }
        .hc-alert.a2 { animation-delay: -1.5s }
        .hc-alert.a3 { animation-delay: -7.5s }
        @media (prefers-reduced-motion: reduce) {
          .hc-ring, .hc-spin, .hc-alert { animation: none }
          .hc-alert { opacity: 1 }
        }
      `}</style>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-stretch sm:gap-2">
        {/* LEFT: data sources */}
        <div className="w-full shrink-0 sm:flex sm:w-[240px] sm:flex-col sm:justify-center">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70 sm:text-xs">
            Your gym data
          </p>
          <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-col sm:gap-3">
            {SOURCES.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.name}
                  className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-2.5 shadow-xs sm:p-3"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white sm:size-9">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground sm:text-sm">
                      {s.name}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground sm:text-xs">
                      {s.meta}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* LEFT connector */}
        <div className="hidden min-w-0 flex-1 sm:block">
          <svg
            viewBox="0 0 180 360"
            preserveAspectRatio="none"
            className="h-full w-full"
            aria-hidden
          >
            <path id="hlp1" d="M0,60 C80,60 100,180 180,180" fill="none" stroke="#cbd5e1" strokeWidth="2" />
            <path id="hlp2" d="M0,140 C80,140 100,180 180,180" fill="none" stroke="#cbd5e1" strokeWidth="2" />
            <path id="hlp3" d="M0,220 C80,220 100,180 180,180" fill="none" stroke="#cbd5e1" strokeWidth="2" />
            <path id="hlp4" d="M0,300 C80,300 100,180 180,180" fill="none" stroke="#cbd5e1" strokeWidth="2" />
            <circle r="3" fill="#a1a1aa"><animateMotion dur="2.4s" repeatCount="indefinite" begin="0s"><mpath href="#hlp1" /></animateMotion></circle>
            <circle r="3" fill="#a1a1aa"><animateMotion dur="2.4s" repeatCount="indefinite" begin="0.6s"><mpath href="#hlp2" /></animateMotion></circle>
            <circle r="3" fill="#a1a1aa"><animateMotion dur="2.4s" repeatCount="indefinite" begin="1.2s"><mpath href="#hlp3" /></animateMotion></circle>
            <circle r="3" fill="#a1a1aa"><animateMotion dur="2.4s" repeatCount="indefinite" begin="1.8s"><mpath href="#hlp4" /></animateMotion></circle>
          </svg>
        </div>

        {/* CENTER: engine */}
        <div className="relative flex w-full shrink-0 items-center justify-center py-1 sm:w-[150px] sm:py-0">
          <div className="hc-ring absolute size-24 rounded-full border-2 border-primary/60 sm:size-28" />
          <div className="hc-ring delay absolute size-24 rounded-full border-2 border-primary/60 sm:size-28" />
          <div className="relative flex size-24 flex-col items-center justify-center rounded-full bg-[#0b1220] ring-1 ring-primary/40 sm:size-28">
            <span className="hc-spin mb-1 block size-3 rounded-[3px] bg-primary" />
            <span className="text-sm font-bold text-white sm:text-base">
              GymOS
            </span>
            <span className="mt-0.5 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Live
            </span>
          </div>
        </div>

        {/* RIGHT connector */}
        <div className="hidden min-w-0 flex-1 sm:block">
          <svg
            viewBox="0 0 180 360"
            preserveAspectRatio="none"
            className="h-full w-full"
            aria-hidden
          >
            <path id="hrp1" d="M0,180 C80,180 100,70 180,70" fill="none" stroke="var(--primary)" strokeWidth="2" strokeOpacity="0.6" />
            <path id="hrp2" d="M0,180 C80,180 100,180 180,180" fill="none" stroke="var(--primary)" strokeWidth="2" strokeOpacity="0.6" />
            <path id="hrp3" d="M0,180 C80,180 100,290 180,290" fill="none" stroke="var(--primary)" strokeWidth="2" strokeOpacity="0.6" />
            <circle r="3.4" fill="var(--primary)"><animateMotion dur="2.2s" repeatCount="indefinite" begin="0.3s"><mpath href="#hrp1" /></animateMotion></circle>
            <circle r="3.4" fill="var(--primary)"><animateMotion dur="2.2s" repeatCount="indefinite" begin="0.9s"><mpath href="#hrp2" /></animateMotion></circle>
            <circle r="3.4" fill="var(--primary)"><animateMotion dur="2.2s" repeatCount="indefinite" begin="1.5s"><mpath href="#hrp3" /></animateMotion></circle>
          </svg>
        </div>

        {/* RIGHT: insights — all visible, spotlight cycles between them */}
        <div className="flex w-full shrink-0 flex-col justify-center gap-2.5 sm:w-[248px] sm:gap-3">
          {ALERTS.map((a, i) => {
            const Icon = a.icon;
            const tone = TONE[a.tone];
            return (
              <div
                key={a.title}
                className={`hc-alert a${i + 1} rounded-xl border border-border border-l-[3px] ${tone.left} bg-card p-2.5 sm:p-3`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-md ${tone.chip}`}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <p className="truncate text-xs font-semibold text-foreground sm:text-sm">
                    {a.title}
                  </p>
                </div>
                <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground sm:text-xs">
                  {a.text}
                </p>
                <span
                  className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${tone.badge}`}
                >
                  {a.severity}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
