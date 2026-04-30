import { MembershipStatusBadge } from "@/components/shared/membership-status-badge";
import type { MembershipHistoryRow } from "@/server/queries/memberships/get-membership-history";
import { formatCalendarDate } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";

type Props = {
  history: MembershipHistoryRow[];
};

export function MembershipHistoryCard({ history }: Props) {
  if (history.length <= 1) return null; // current is shown separately

  // Skip the most recent — that's the current card.
  const past = history.slice(1);

  return (
    <section className="bg-card rounded-xl border p-5">
      <h2 className="text-foreground mb-3 text-sm font-semibold tracking-tight">
        Past memberships
      </h2>
      <ul className="divide-border divide-y">
        {past.map((m) => (
          <li
            key={m.id}
            className="flex items-start justify-between gap-3 py-3 text-sm first:pt-0 last:pb-0"
          >
            <div className="min-w-0 flex-1">
              <p className="text-foreground font-medium">{m.planName}</p>
              <p className="text-muted-foreground text-xs">
                {formatCalendarDate(m.startDate)} → {formatCalendarDate(m.endDate)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-foreground tabular-nums text-sm">
                {formatMoney(m.finalAmountPaise)}
              </span>
              <MembershipStatusBadge status={m.effectiveStatus} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
