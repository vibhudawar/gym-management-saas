import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { payments } from "@/lib/db/schema/payments";
import { requireUser } from "@/lib/auth/get-session";

export type PaymentDetail = typeof payments.$inferSelect & {
  alreadyRefundedPaise: number; // negative number, sum of refund rows; 0 if none
};

/**
 * Single payment with the cumulative refund amount applied to it. Used by
 * the refund flow to compute remaining-refundable.
 */
export async function getPayment(id: string): Promise<PaymentDetail | null> {
  const session = await requireUser();
  const [row] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.id, id),
        eq(payments.gymId, session.gym.id),
        isNull(payments.deletedAt),
      ),
    )
    .limit(1);
  if (!row) return null;

  const [{ alreadyRefundedPaise }] = await db
    .select({
      alreadyRefundedPaise: sql<number>`coalesce(sum(${payments.amountPaise}), 0)::int`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.refundOfPaymentId, row.id),
        eq(payments.gymId, session.gym.id),
        isNull(payments.deletedAt),
      ),
    );

  return { ...row, alreadyRefundedPaise: alreadyRefundedPaise ?? 0 };
}
