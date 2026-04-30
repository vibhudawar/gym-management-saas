import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { payments, type Payment } from "@/lib/db/schema/payments";
import { users } from "@/lib/db/schema/users";
import { requireUser } from "@/lib/auth/get-session";

export type MembershipPaymentRow = Payment & { receivedByName: string | null };

export async function getPaymentsByMembership(
  membershipId: string,
): Promise<MembershipPaymentRow[]> {
  const session = await requireUser();
  return db
    .select({
      id: payments.id,
      gymId: payments.gymId,
      branchId: payments.branchId,
      membershipId: payments.membershipId,
      memberId: payments.memberId,
      amountPaise: payments.amountPaise,
      paymentMode: payments.paymentMode,
      paymentDate: payments.paymentDate,
      invoiceNumber: payments.invoiceNumber,
      kind: payments.kind,
      refundOfPaymentId: payments.refundOfPaymentId,
      reason: payments.reason,
      notes: payments.notes,
      receivedByUserId: payments.receivedByUserId,
      correctedAt: payments.correctedAt,
      correctedByUserId: payments.correctedByUserId,
      correctionCount: payments.correctionCount,
      createdAt: payments.createdAt,
      updatedAt: payments.updatedAt,
      deletedAt: payments.deletedAt,
      receivedByName: users.name,
    })
    .from(payments)
    .leftJoin(users, eq(users.id, payments.receivedByUserId))
    .where(
      and(
        eq(payments.membershipId, membershipId),
        eq(payments.gymId, session.gym.id),
        isNull(payments.deletedAt),
      ),
    )
    .orderBy(asc(payments.paymentDate), asc(payments.createdAt));
}
