import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/get-session";
import { isManagerOrOwner, isOwner } from "@/lib/auth/roles";
import { listActiveBranches } from "@/server/queries/branches/list-active-branches";
import { listAddOns } from "@/server/queries/add-ons/list-add-ons";
import { listPlans } from "@/server/queries/plans/list-plans";
import { getMember } from "@/server/queries/members/get-member";
import { getCurrentMembership } from "@/server/queries/memberships/get-current-membership";
import { getMembershipHistory } from "@/server/queries/memberships/get-membership-history";
import { getPaymentsByMember } from "@/server/queries/payments/get-payments-by-member";
import { CurrentMembershipCard } from "./_components/current-membership-card";
import { MemberActivityCard } from "./_components/member-activity-card";
import { MemberDetailHeader } from "./_components/member-detail-header";
import { MembershipHistoryCard } from "./_components/membership-history-card";
import {
  MemberExtrasCard,
  MemberNotesCard,
  MemberProfileCard,
} from "./_components/member-profile-card";
import { RecentPaymentsCard } from "./_components/recent-payments-card";

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

  const [branches, plans, addOns, current, history, payments] = await Promise.all([
    listActiveBranches(),
    listPlans({ includeInactive: false }),
    listAddOns({ includeInactive: false }),
    getCurrentMembership(member.id),
    getMembershipHistory(member.id),
    getPaymentsByMember(member.id, 5),
  ]);

  const isDeleted = member.deletedAt !== null;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <MemberDetailHeader
        member={member}
        branches={branches}
        canEdit={canEdit && !isDeleted}
        canDelete={canEdit && !isDeleted}
        canRestore={owner && isDeleted}
      />

      <div className="mt-2 grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <MemberProfileCard member={member} />
          <MemberExtrasCard member={member} />
          <MemberNotesCard member={member} />
          <MembershipHistoryCard history={history} />
        </div>
        <div className="space-y-4 lg:col-span-2">
          <CurrentMembershipCard
            memberId={member.id}
            branchId={member.branchId}
            current={current}
            plans={plans}
            addOns={addOns}
            canEnrol={canEdit && !isDeleted}
            user={{
              id: session.user.id,
              role: session.user.role,
              branchId: session.user.branchId,
            }}
            primaryPayment={(() => {
              if (!current) return null;
              const positives = payments.filter(
                (p) =>
                  p.kind === "payment" && p.membershipId === current.id,
              );
              if (positives.length === 0) return null;
              const original = positives[positives.length - 1];
              const refunded = payments
                .filter(
                  (p) =>
                    p.kind === "refund" && p.refundOfPaymentId === original.id,
                )
                .reduce((sum, p) => sum + p.amountPaise, 0);
              return {
                id: original.id,
                amountPaise: original.amountPaise,
                paymentMode: original.paymentMode,
                alreadyRefundedPaise: refunded,
              };
            })()}
          />
          <RecentPaymentsCard
            memberId={member.id}
            payments={payments}
            canManagePayments={owner && !isDeleted}
          />
          <Suspense fallback={<Skeleton className="h-32 rounded-xl" />}>
            <MemberActivityCard memberId={member.id} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
