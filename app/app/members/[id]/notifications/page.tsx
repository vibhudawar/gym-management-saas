import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireUser } from "@/lib/auth/get-session";
import { EVENT_TYPE_LABEL } from "@/lib/notifications/templates";
import { formatDateTime } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";
import { getMember } from "@/server/queries/members/get-member";
import { listNotificationsByMember } from "@/server/queries/notifications/list-by-member";

export const metadata: Metadata = { title: "Notifications" };

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

export default async function MemberNotificationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireUser();
  void session;
  const [member, rows] = await Promise.all([
    getMember(id),
    listNotificationsByMember(id, 200),
  ]);
  if (!member) notFound();

  return (
    <div className="mx-auto w-full max-w-5xl">
      <Link
        href={`/app/members/${id}`}
        className="text-muted-foreground hover:text-foreground mb-1 inline-flex items-center gap-1 text-xs"
      >
        <ArrowLeft className="size-3.5" />
        Back to {member.name}
      </Link>
      <PageHeader
        title="Notifications"
        description={`All messages sent to ${member.name}.`}
      />
      {rows.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center text-sm">
          No notifications have been sent to this member yet.
        </p>
      ) : (
        <section
          data-slot="card"
          className="bg-gradient-to-t from-primary/5 to-card text-card-foreground ring-foreground/10 dark:bg-card mt-4 overflow-hidden rounded-xl ring-1 shadow-xs"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-5">Sent</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-5">Body</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground px-5 text-xs">
                    {formatDateTime(r.createdAt)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {EVENT_TYPE_LABEL[r.eventType]}
                  </TableCell>
                  <TableCell className="text-foreground/80 text-xs uppercase">
                    {r.channel}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("text-xs", STATUS_TONE[r.status])}
                    >
                      {STATUS_LABEL[r.status]}
                    </Badge>
                    {r.failureReason ? (
                      <p className="text-destructive mt-0.5 text-[10px]">
                        {r.failureReason}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground pr-5 text-xs">
                    <span className="line-clamp-2 max-w-md whitespace-pre-line">
                      {r.messageBody}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}
    </div>
  );
}
