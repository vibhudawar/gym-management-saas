import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { requireRole } from "@/lib/auth/get-session";
import { EVENT_TYPE_LABEL } from "@/lib/notifications/templates";
import { formatRelative } from "@/lib/utils/dates";
import {
  getNotificationStats,
  listRecentNotificationsByGym,
} from "@/server/queries/notifications/list-recent-by-gym";
import { TestMessageButton } from "./_components/test-message-button";

export const metadata: Metadata = { title: "Notifications · Settings" };

const STATUS_LABEL: Record<string, string> = {
  delivered: "Delivered",
  sent: "Sent",
  pending: "Queued",
  failed: "Failed",
};

const STATUS_TONE: Record<string, string> = {
  delivered: "border-emerald-500/40 bg-emerald-500/5 text-emerald-700",
  sent: "border-emerald-500/40 bg-emerald-500/5 text-emerald-700",
  pending: "border-amber-500/40 bg-amber-500/5 text-amber-700",
  failed: "border-destructive/40 bg-destructive/5 text-destructive",
};

function ConfigRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-border/50 grid grid-cols-1 gap-1 border-b py-3 last:border-0 sm:grid-cols-3">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        {label}
      </p>
      <div className="sm:col-span-2 text-sm">{value}</div>
    </div>
  );
}

export default async function NotificationsSettingsPage() {
  const session = await requireRole("owner");
  const [recent, stats] = await Promise.all([
    listRecentNotificationsByGym(20),
    getNotificationStats(),
  ]);

  const isPro = session.gym.subscriptionTier === "pro";

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PageHeader
        title="Notifications"
        description="Receipts that go out to members on every payment-affecting event."
      />

      <section
        data-slot="card"
        className="bg-gradient-to-t from-primary/5 to-card text-card-foreground ring-foreground/10 dark:bg-card overflow-hidden rounded-xl px-5 py-3 ring-1 shadow-xs"
      >
        <ConfigRow
          label="Channel"
          value={
            <span className="space-x-2">
              <Badge variant="outline">SMS</Badge>
              {session.gym.notificationChannel.includes("whatsapp") ? (
                <Badge variant="outline">WhatsApp</Badge>
              ) : isPro ? (
                <span className="text-muted-foreground text-xs">
                  WhatsApp available — contact us to enable.
                </span>
              ) : (
                <span className="text-muted-foreground text-xs">
                  WhatsApp lands in Pro tier.
                </span>
              )}
            </span>
          }
        />
        <ConfigRow
          label="Provider"
          value={
            <span className="font-mono text-xs uppercase">
              {session.gym.notificationProvider}
            </span>
          }
        />
        <ConfigRow
          label="Sender ID"
          value={
            session.gym.senderId ? (
              <span className="font-mono text-xs">{session.gym.senderId}</span>
            ) : (
              <span className="text-muted-foreground text-xs">
                Not configured. Required when switching to MSG91 — file DLT
                registration to obtain one.
              </span>
            )
          }
        />
        <div className="pt-3">
          <TestMessageButton />
          <p className="text-muted-foreground mt-1 text-xs">
            Sends a fixed test payload to your own phone via the configured provider.
          </p>
        </div>
      </section>

      <section
        data-slot="card"
        className="bg-gradient-to-t from-primary/5 to-card text-card-foreground ring-foreground/10 dark:bg-card overflow-hidden rounded-xl ring-1 shadow-xs"
      >
        <header className="px-5 pt-4 pb-3">
          <h2 className="text-foreground text-base font-semibold tracking-tight">
            Last 7 days
          </h2>
          <p className="text-muted-foreground text-xs">
            {stats.last7Days.total.toLocaleString("en-IN")} sent ·{" "}
            {stats.last7Days.delivered.toLocaleString("en-IN")} delivered ·{" "}
            <span
              className={
                stats.last7Days.failed > 0 ? "text-destructive" : "text-muted-foreground"
              }
            >
              {stats.last7Days.failed.toLocaleString("en-IN")} failed
            </span>
          </p>
        </header>
        {recent.length === 0 ? (
          <p className="text-muted-foreground px-5 pb-5 text-sm">
            No notifications dispatched yet.
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {recent.map((r) => (
              <li
                key={r.id}
                className="grid grid-cols-12 items-center gap-3 px-5 py-3 text-sm"
              >
                <div className="col-span-5 min-w-0">
                  <Link
                    href={`/members/${r.memberId}`}
                    className="text-foreground truncate font-medium hover:underline"
                  >
                    {r.memberName ?? "(removed member)"}
                  </Link>
                  <p className="text-muted-foreground text-xs">
                    {EVENT_TYPE_LABEL[r.eventType]}
                  </p>
                </div>
                <div className="col-span-2 text-xs uppercase text-muted-foreground">
                  {r.channel}
                </div>
                <div className="col-span-3">
                  <Badge variant="outline" className={`text-xs ${STATUS_TONE[r.status]}`}>
                    {STATUS_LABEL[r.status]}
                  </Badge>
                  {r.failureReason ? (
                    <p className="text-destructive mt-0.5 text-[10px] line-clamp-1">
                      {r.failureReason}
                    </p>
                  ) : null}
                </div>
                <div className="col-span-2 text-right text-xs text-muted-foreground">
                  {formatRelative(r.createdAt)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
