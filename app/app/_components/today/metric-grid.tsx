import type { Role } from "@/lib/auth/roles";
import { formatMoneyShort } from "@/lib/utils/money";
import { todayIstIso } from "@/lib/utils/dates";
import type { TodaySnapshot } from "@/server/queries/today/get-today-snapshot";
import { MetricCard } from "./metric-card";

type Props = {
  snapshot: TodaySnapshot;
  userRole: Role;
};

function pluralize(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many;
}

function diffText(today: number, yesterday: number): {
  text: string;
  direction: "up" | "down" | "flat";
} {
  if (today === yesterday) return { text: "0%", direction: "flat" };
  if (yesterday === 0) return { text: "↑ from 0", direction: "up" };
  const delta = today - yesterday;
  const sign = delta > 0 ? "↑" : "↓";
  const absPct = Math.round((Math.abs(delta) / yesterday) * 100);
  return {
    text: `${sign} ${absPct}%`,
    direction: delta > 0 ? "up" : "down",
  };
}

function moneyDelta(today: number, yesterday: number): {
  text: string;
  direction: "up" | "down" | "flat";
} {
  const delta = today - yesterday;
  if (delta === 0) return { text: "0%", direction: "flat" };
  const sign = delta > 0 ? "↑" : "↓";
  return {
    text: `${sign} ${formatMoneyShort(Math.abs(delta))}`,
    direction: delta > 0 ? "up" : "down",
  };
}

/**
 * Four-up metric grid in the dashboard-01 style: subtle gradient + shadow
 * applied at the parent via `*:` arbitrary-property selectors so each Card
 * picks them up without ad-hoc classNames. Container queries (`@container/card`)
 * scale the big number to the card's own width.
 */
export function MetricGrid({ snapshot, userRole }: Props) {
  const showRevenue = userRole !== "receptionist";
  const m = snapshot.metrics;

  const enrollmentDelta = diffText(m.enrollmentsToday, m.enrollmentsYesterday);
  const revenueDelta = moneyDelta(m.revenueTodayPaise, m.revenueYesterdayPaise);

  const enrollmentHeadline = (() => {
    if (m.enrollmentsToday === m.enrollmentsYesterday)
      return "Same as yesterday";
    if (m.enrollmentsToday > m.enrollmentsYesterday)
      return "Up from yesterday";
    return "Down from yesterday";
  })();

  const revenueHeadline = (() => {
    const delta = m.revenueTodayPaise - m.revenueYesterdayPaise;
    if (delta === 0) return "Same as yesterday";
    if (delta > 0) return "Trending up vs yesterday";
    return "Down vs yesterday";
  })();

  const expiringHeadline = (() => {
    if (m.expiringIn3d > 0) return `${m.expiringIn3d} ending in 3 days`;
    if (m.expiringIn7d > 0) return `${m.expiringIn7d} ending in 7 days`;
    if (m.expiringIn14d === 0) return "All clear for the next 14 days";
    return "All beyond a week";
  })();

  const frozenHeadline = (() => {
    if (m.frozenNow === 0) return "No active freezes";
    if (m.resumingIn7d > 0) return `${m.resumingIn7d} resuming in 7 days`;
    return "All on hold";
  })();

  const todayHref = `/payments?from=${todayIstIso()}&to=${todayIstIso()}`;

  // Grid: 4 equal cards on desktop, 2-up on tablet, stack on mobile. Receptionist
  // hides revenue, leaving 3 cards which still flow neatly in 2 / 3 / stack.
  const gridClass = showRevenue
    ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
    : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3";

  // The dashboard-01 gradient + shadow trick: applied at the parent so each
  // Card data-slot picks it up automatically.
  const accentClasses =
    "*:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs dark:*:data-[slot=card]:bg-card";

  return (
    <div className={`${gridClass} ${accentClasses}`}>
      {showRevenue ? (
        <MetricCard
          label="Collected today"
          bigNumber={formatMoneyShort(m.revenueTodayPaise)}
          delta={revenueDelta}
          footerHeadline={revenueHeadline}
          footerDirection={revenueDelta.direction}
          footerSubline={`Yesterday ${formatMoneyShort(m.revenueYesterdayPaise)}`}
          href={todayHref}
        />
      ) : null}
      <MetricCard
        label={`New ${pluralize(m.enrollmentsToday, "enrolment")} today`}
        bigNumber={m.enrollmentsToday.toLocaleString("en-IN")}
        delta={enrollmentDelta}
        footerHeadline={enrollmentHeadline}
        footerDirection={enrollmentDelta.direction}
        footerSubline={`Yesterday ${m.enrollmentsYesterday.toLocaleString("en-IN")}`}
        href="/members?membership=active"
      />
      <MetricCard
        label="Expiring in 14 days"
        bigNumber={m.expiringIn14d.toLocaleString("en-IN")}
        delta={null}
        footerHeadline={expiringHeadline}
        footerDirection="flat"
        footerSubline={
          m.expiringIn14d > 0
            ? `${m.expiringIn7d} in 7d · ${m.expiringIn3d} in 3d`
            : "Next 14 days"
        }
        href="/members?membership=expiring"
      />
      <MetricCard
        label="Frozen now"
        bigNumber={m.frozenNow.toLocaleString("en-IN")}
        delta={null}
        footerHeadline={frozenHeadline}
        footerDirection="flat"
        footerSubline={
          m.resumingIn7d > 0
            ? `${m.resumingIn7d} resuming in next 7 days`
            : "Currently on hold"
        }
        href="/members?membership=frozen"
      />
    </div>
  );
}
