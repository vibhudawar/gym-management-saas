import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { payments, type PaymentMode } from "@/lib/db/schema/payments";
import { recordAudit } from "@/lib/auth/audit";
import type { SessionContext } from "@/lib/auth/get-session";
import { allocateInvoiceNumber } from "./invoice-numbering";

export type RefundInput = {
  paymentId: string;
  amountPaise: number; // positive — service negates internally
  reason: string;
  refundDate: string; // YYYY-MM-DD
  paymentMode: PaymentMode;
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
    }
  | { ok: false; code: RefundErrorCode; message: string };

const MIN_REASON_CHARS = 10;

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

      return {
        ok: true as const,
        paymentId: refundRow.id,
        invoiceNumber,
        _audit: refundRow,
      };
    })
    .then(async (result) => {
      if (result.ok) {
        const r = result as typeof result & { _audit: unknown };
        await recordAudit({
          entityType: "payment",
          entityId: r.paymentId,
          action: "create",
          after: r._audit,
        });
        return {
          ok: true as const,
          paymentId: r.paymentId,
          invoiceNumber: r.invoiceNumber,
        };
      }
      return result;
    });
}
