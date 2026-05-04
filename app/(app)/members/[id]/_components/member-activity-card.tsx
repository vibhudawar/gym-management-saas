import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { listMemberAuditEntries } from "@/server/queries/members/list-member-audit";
import { formatRelative } from "@/lib/utils/dates";

const ACTION_LABEL: Record<string, string> = {
  create: "Member created",
  update: "Profile updated",
  delete: "Member deleted",
};

export async function MemberActivityCard({ memberId }: { memberId: string }) {
  const entries = await listMemberAuditEntries(memberId, 5);

  return (
    <section className="bg-card rounded-xl border p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-foreground text-sm font-semibold tracking-tight">
          Activity
        </h2>
        {entries.length > 0 ? (
          <Link
            href={`/audit-log?entity_type=member&entity_id=${memberId}`}
            className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
          >
            View full history
            <ArrowRight className="size-3" />
          </Link>
        ) : null}
      </div>
      {entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">No activity yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {entries.map((entry) => (
            <li key={String(entry.id)} className="text-foreground text-sm">
              <span>{ACTION_LABEL[entry.action] ?? entry.action}</span>
              <span className="text-muted-foreground">
                {entry.actorName ? ` by ${entry.actorName}` : ""} ·{" "}
                {formatRelative(entry.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
