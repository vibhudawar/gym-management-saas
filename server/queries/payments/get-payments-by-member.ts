import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { payments, type Payment } from "@/lib/db/schema/payments";
import { users } from "@/lib/db/schema/users";
import { requireUser } from "@/lib/auth/get-session";

export type MemberPaymentRow = Payment & { receivedByName: string | null };

export async function getPaymentsByMember(
  memberId: string,
  limit?: number,
): Promise<MemberPaymentRow[]> {
  const session = await requireUser();
  const query = db
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
        eq(payments.memberId, memberId),
        eq(payments.gymId, session.gym.id),
        isNull(payments.deletedAt),
      ),
    )
    .orderBy(desc(payments.paymentDate), desc(payments.createdAt));
  return limit ? query.limit(limit) : query;
}
