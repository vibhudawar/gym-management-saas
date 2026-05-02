import type { Metadata } from "next";
import { formatInTimeZone } from "date-fns-tz";
import { ActionList } from "./_components/today/action-list";
import { AllClearCard } from "./_components/today/all-clear-card";
import { EnrolledToday } from "./_components/today/enrolled-today";
import { MetricGrid } from "./_components/today/metric-grid";
import { TodayHeader } from "./_components/today/today-header";
import { requireUser } from "@/lib/auth/get-session";
import { todayIstIso } from "@/lib/utils/dates";
import { getTodaySnapshot } from "@/server/queries/today/get-today-snapshot";

export const metadata: Metadata = { title: "Today" };

const IST = "Asia/Kolkata";

export default async function TodayPage() {
  const session = await requireUser();
  const snapshot = await getTodaySnapshot();
  const dateLabel = formatInTimeZone(snapshot.asOf, IST, "EEEE, d MMM yyyy");

  const bothActionListsEmpty =
    snapshot.expiringSoonTotal === 0 && snapshot.recentlyExpiredTotal === 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <TodayHeader
        asOf={snapshot.asOf}
        branchName={snapshot.branchName}
        dateLabel={dateLabel}
      />

      <MetricGrid snapshot={snapshot} userRole={session.user.role} />

      {bothActionListsEmpty ? (
        <AllClearCard />
      ) : (
        <div className="grid items-stretch gap-4 lg:grid-cols-2">
          <div id="expiring-soon" className="scroll-mt-24 h-full">
            <ActionList
              kind="expiring"
              rows={snapshot.expiringSoon}
              total={snapshot.expiringSoonTotal}
              gymName={session.gym.name}
              asOf={snapshot.asOf}
            />
          </div>
          <div className="scroll-mt-24 h-full">
            <ActionList
              kind="expired"
              rows={snapshot.recentlyExpired}
              total={snapshot.recentlyExpiredTotal}
              gymName={session.gym.name}
              asOf={snapshot.asOf}
            />
          </div>
        </div>
      )}

      <EnrolledToday
        rows={snapshot.enrolledToday}
        total={snapshot.enrolledTodayTotal}
        currentUserId={session.user.id}
        highlightOwnRows={session.user.role === "receptionist"}
        todayIstIso={todayIstIso()}
      />
    </div>
  );
}
