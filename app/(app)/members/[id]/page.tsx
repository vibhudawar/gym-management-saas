import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/get-session";
import { isManagerOrOwner, isOwner } from "@/lib/auth/roles";
import { listActiveBranches } from "@/server/queries/branches/list-active-branches";
import { getMember } from "@/server/queries/members/get-member";
import { MemberActivityCard } from "./_components/member-activity-card";
import { MemberDetailHeader } from "./_components/member-detail-header";
import {
  MembershipPlaceholderCard,
  PaymentsPlaceholderCard,
} from "./_components/member-placeholder-cards";
import {
  MemberExtrasCard,
  MemberNotesCard,
  MemberProfileCard,
} from "./_components/member-profile-card";

export const metadata: Metadata = { title: "Member" };

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireUser();
  const owner = isOwner(session.user.role);
  const canEdit = isManagerOrOwner(session.user.role);

  const member = await getMember(id);
  if (!member) notFound();

  const branches = await listActiveBranches();

  return (
    <div className="mx-auto w-full max-w-6xl">
      <MemberDetailHeader
        member={member}
        branches={branches}
        canEdit={canEdit && member.deletedAt === null}
        canDelete={canEdit && member.deletedAt === null}
        canRestore={owner && member.deletedAt !== null}
      />

      <div className="mt-2 grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <MemberProfileCard member={member} />
          <MemberExtrasCard member={member} />
          <MemberNotesCard member={member} />
        </div>
        <div className="space-y-4 lg:col-span-2">
          <MembershipPlaceholderCard />
          <PaymentsPlaceholderCard />
          <Suspense fallback={<Skeleton className="h-32 rounded-xl" />}>
            <MemberActivityCard memberId={member.id} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
