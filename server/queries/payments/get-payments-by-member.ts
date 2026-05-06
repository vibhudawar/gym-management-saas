import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { payments, type Payment } from "@/lib/db/schema/payments";
import { users } from "@/lib/db/schema/users";
import { requireUser } from "@/lib/auth/get-session";

/**
 * Slim projection used by both the recent-payments card on member detail
 * and the full member payments page. The card hands rows to the Edit/Refund
 * sheets which need `notes` and `membershipId`; the page itself uses the
 * `kind`/`refundOfPaymentId` pair to compute net-after-refunds, and the
 * `correctedAt` flag for the "Corrected" badge. Every other column on the
 * `payments` table is unused at this read site — keep the projection
 * narrow so the RSC payload stays tight as `payments.notes` grows.
 */
export type MemberPaymentRow = Pick<
  Payment,
  | "id"
  | "membershipId"
  | "amountPaise"
  | "paymentMode"
  | "paymentDate"
  | "invoiceNumber"
  | "kind"
  | "refundOfPaymentId"
  | "notes"
  | "correctedAt"
> & { receivedByName: string | null };

export async function getPaymentsByMember(
  memberId: string,
  limit?: number,
): Promise<MemberPaymentRow[]> {
  const session = await requireUser();
  const query = db
    .select({
      id: payments.id,
      membershipId: payments.membershipId,
      amountPaise: payments.amountPaise,
      paymentMode: payments.paymentMode,
      paymentDate: payments.paymentDate,
      invoiceNumber: payments.invoiceNumber,
      kind: payments.kind,
      refundOfPaymentId: payments.refundOfPaymentId,
      notes: payments.notes,
      correctedAt: payments.correctedAt,
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
