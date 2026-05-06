import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { memberships } from "@/lib/db/schema/memberships";
import { payments, type PaymentMode } from "@/lib/db/schema/payments";
import { recordAudit } from "@/lib/auth/audit";
import type { SessionContext } from "@/lib/auth/get-session";
import { MIN_REASON_CHARS } from "@/lib/constants/validation";
import { allocateInvoiceNumber } from "./invoice-numbering";
import { notifyRefund } from "./notification-helpers";

export type RefundInput = {
  paymentId: string;
  amountPaise: number; // positive — service negates internally
  reason: string;
  refundDate: string; // YYYY-MM-DD
  paymentMode: PaymentMode;
  /**
   * When true, skip the standalone refund receipt — the caller is
   * responsible for sending its own combined message (e.g.,
   * cancel-membership sends one cancellation receipt that already mentions
   * the refund amount).
   */
  suppressNotification?: boolean;
};

export type RefundErrorCode =
  | "PAYMENT_NOT_FOUND"
  | "CANNOT_REFUND_REFUND"
  | "INVALID_REFUND_AMOUNT"
  | "REASON_TOO_SHORT"
  | "INVALID_DATE";

export type RefundResult =
  | {
      ok: true;
      paymentId: string;
      invoiceNumber: string;
      /**
       * True when the cumulative refunds against the original payment now equal
       * (or exceed) the linked membership's final amount AND the membership is
       * still active/frozen. The UI uses this to prompt the owner to cancel.
       */
      requiresCancellationPrompt: boolean;
      membershipId: string | null;
    }
  | { ok: false; code: RefundErrorCode; message: string };

export async function recordRefundService(
  session: SessionContext,
  input: RefundInput,
): Promise<RefundResult> {
  const reason = (input.reason ?? "").trim();
  if (reason.length < MIN_REASON_CHARS) {
    return {
      ok: false,
      code: "REASON_TOO_SHORT",
      message: `Reason must be at least ${MIN_REASON_CHARS} characters.`,
    };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.refundDate)) {
    return { ok: false, code: "INVALID_DATE", message: "Refund date is invalid." };
  }
  if (!Number.isInteger(input.amountPaise) || input.amountPaise <= 0) {
    return {
      ok: false,
      code: "INVALID_REFUND_AMOUNT",
      message: "Refund amount must be a positive integer (paise).",
    };
  }

  return db
    .transaction(async (tx) => {
      // Lock the original payment so concurrent refunds can't over-refund.
      const [originalLocked] = await tx
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.id, input.paymentId),
            eq(payments.gymId, session.gym.id),
            isNull(payments.deletedAt),
          ),
        )
        .for("update")
        .limit(1);

      if (!originalLocked) {
        return {
          ok: false as const,
          code: "PAYMENT_NOT_FOUND" as const,
          message: "Payment not found.",
        };
      }
      if (originalLocked.kind !== "payment") {
        return {
          ok: false as const,
          code: "CANNOT_REFUND_REFUND" as const,
          message: "You can only refund a payment, not another refund.",
        };
      }

      // Sum prior refunds for this payment.
      const [{ already }] = await tx
        .select({
          already: sql<number>`coalesce(sum(${payments.amountPaise}), 0)::int`,
        })
        .from(payments)
        .where(
          and(
            eq(payments.refundOfPaymentId, input.paymentId),
            eq(payments.gymId, session.gym.id),
            isNull(payments.deletedAt),
          ),
        );
      // already is negative (refunds are negative); refundable is the unrefunded balance
      const refundable = originalLocked.amountPaise + already;
      if (input.amountPaise > refundable) {
        return {
          ok: false as const,
          code: "INVALID_REFUND_AMOUNT" as const,
          message: `Refund exceeds the remaining refundable amount (₹${(refundable / 100).toFixed(2)}).`,
        };
      }

      const invoiceNumber = await allocateInvoiceNumber(
        tx,
        session.gym.id,
        new Date(`${input.refundDate}T00:00:00Z`),
      );

      const [refundRow] = await tx
        .insert(payments)
        .values({
          gymId: session.gym.id,
          branchId: originalLocked.branchId,
          membershipId: originalLocked.membershipId,
          memberId: originalLocked.memberId,
          amountPaise: -input.amountPaise,
          paymentMode: input.paymentMode,
          paymentDate: input.refundDate,
          invoiceNumber,
          kind: "refund",
          refundOfPaymentId: originalLocked.id,
          reason,
          receivedByUserId: session.user.id,
        })
        .returning();

      // After this refund, total refunded against the original (positive integer):
      // already is ≤ 0; subtract to flip sign.
      const totalRefundedPositive = -already + input.amountPaise;
      let requiresCancellationPrompt = false;
      if (originalLocked.membershipId) {
        const [membership] = await tx
          .select({
            status: memberships.status,
            finalAmountPaise: memberships.finalAmountPaise,
          })
          .from(memberships)
          .where(
            and(
              eq(memberships.id, originalLocked.membershipId),
              eq(memberships.gymId, session.gym.id),
              isNull(memberships.deletedAt),
            ),
          )
          .limit(1);
        if (
          membership &&
          (membership.status === "active" || membership.status === "frozen") &&
          totalRefundedPositive >= membership.finalAmountPaise
        ) {
          requiresCancellationPrompt = true;
        }
      }

      return {
        ok: true as const,
        paymentId: refundRow.id,
        invoiceNumber,
        requiresCancellationPrompt,
        membershipId: originalLocked.membershipId ?? null,
        _audit: refundRow,
        _refundRow: refundRow,
        _original: originalLocked,
      };
    })
    .then(async (result) => {
      if (result.ok) {
        const r = result as typeof result & {
          _audit: unknown;
          _refundRow: typeof payments.$inferSelect;
          _original: typeof payments.$inferSelect;
        };
        await recordAudit({
          entityType: "payment",
          entityId: r.paymentId,
          branchId: r._refundRow.branchId,
          action: "create",
          after: r._audit,
        });

        if (!input.suppressNotification) {
          // Receipt to the member. Fire-and-forget; never throws past here.
          void notifyRefund(r._refundRow, r._original, {
            id: r._original.memberId,
            gymId: r._original.gymId,
            branchId: r._original.branchId,
          });
        }

        return {
          ok: true as const,
          paymentId: r.paymentId,
          invoiceNumber: r.invoiceNumber,
          requiresCancellationPrompt: r.requiresCancellationPrompt,
          membershipId: r.membershipId,
        };
      }
      return result;
    });
}
