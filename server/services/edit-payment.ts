import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { memberships } from "@/lib/db/schema/memberships";
import { payments, type PaymentMode } from "@/lib/db/schema/payments";
import { recordAudit } from "@/lib/auth/audit";
import type { SessionContext } from "@/lib/auth/get-session";

export type EditPaymentInput = {
  paymentId: string;
  amountPaise?: number;
  paymentMode?: PaymentMode;
  paymentDate?: string;
  notes?: string | null;
  reason: string;
};

export type EditPaymentErrorCode =
  | "PAYMENT_NOT_FOUND"
  | "CANNOT_EDIT_REFUND"
  | "INVALID_AMOUNT"
  | "REASON_TOO_SHORT"
  | "INVALID_DATE"
  | "NO_CHANGES";

export type EditPaymentResult =
  | { ok: true; paymentId: string }
  | { ok: false; code: EditPaymentErrorCode; message: string };

const MIN_REASON_CHARS = 10;

export async function editPaymentService(
  session: SessionContext,
  input: EditPaymentInput,
): Promise<EditPaymentResult> {
  const reason = (input.reason ?? "").trim();
  if (reason.length < MIN_REASON_CHARS) {
    return {
      ok: false,
      code: "REASON_TOO_SHORT",
      message: `Reason must be at least ${MIN_REASON_CHARS} characters.`,
    };
  }

  if (input.paymentDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(input.paymentDate)) {
    return { ok: false, code: "INVALID_DATE", message: "Date must be YYYY-MM-DD." };
  }
  if (input.amountPaise !== undefined) {
    if (!Number.isInteger(input.amountPaise) || input.amountPaise <= 0) {
      return {
        ok: false,
        code: "INVALID_AMOUNT",
        message: "Amount must be a positive integer (paise).",
      };
    }
  }

  return db
    .transaction(async (tx) => {
      const [before] = await tx
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
      if (!before) {
        return {
          ok: false as const,
          code: "PAYMENT_NOT_FOUND" as const,
          message: "Payment not found.",
        };
      }
      if (before.kind === "refund") {
        return {
          ok: false as const,
          code: "CANNOT_EDIT_REFUND" as const,
          message: "Refunds cannot be edited. Issue a corrective payment instead.",
        };
      }

      const updates: Partial<typeof payments.$inferInsert> = {};
      if (input.amountPaise !== undefined && input.amountPaise !== before.amountPaise) {
        updates.amountPaise = input.amountPaise;
      }
      if (input.paymentMode !== undefined && input.paymentMode !== before.paymentMode) {
        updates.paymentMode = input.paymentMode;
      }
      if (input.paymentDate !== undefined && input.paymentDate !== before.paymentDate) {
        updates.paymentDate = input.paymentDate;
      }
      if (input.notes !== undefined && (input.notes ?? null) !== before.notes) {
        updates.notes = input.notes ?? null;
      }
      updates.reason = reason;
      if (Object.keys(updates).length === 1 /* only reason */) {
        return {
          ok: false as const,
          code: "NO_CHANGES" as const,
          message: "No changes to save.",
        };
      }

      const [after] = await tx
        .update(payments)
        .set(updates)
        .where(eq(payments.id, before.id))
        .returning();

      // If amount changed and this is the only payment for the membership,
      // keep membership.final_amount_paise in sync (single-payment world v1).
      if (updates.amountPaise !== undefined) {
        const sibling = await tx
          .select({ id: payments.id })
          .from(payments)
          .where(
            and(
              eq(payments.membershipId, before.membershipId),
              eq(payments.kind, "payment"),
              isNull(payments.deletedAt),
            ),
          );
        if (sibling.length === 1 && sibling[0].id === before.id) {
          await tx
            .update(memberships)
            .set({
              finalAmountPaise: updates.amountPaise as number,
              updatedAt: sql`now()`,
            })
            .where(eq(memberships.id, before.membershipId));
        }
      }

      return {
        ok: true as const,
        paymentId: after.id,
        _audit: { before, after },
      };
    })
    .then(async (result) => {
      if (result.ok) {
        const r = result as typeof result & {
          _audit: { before: unknown; after: unknown };
        };
        await recordAudit({
          entityType: "payment",
          entityId: r.paymentId,
          action: "update",
          before: r._audit.before,
          after: r._audit.after,
        });
        return { ok: true as const, paymentId: r.paymentId };
      }
      return result;
    });
}
