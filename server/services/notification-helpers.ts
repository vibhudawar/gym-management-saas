import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import type { Membership } from "@/lib/db/schema/memberships";
import type { Payment } from "@/lib/db/schema/payments";
import { plans } from "@/lib/db/schema/plans";
import { formatCalendarDate } from "@/lib/utils/dates";
import { dispatchNotification } from "./dispatch-notification";

const MODE_LABEL: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  bank_transfer: "Bank transfer",
};

function rupees(paise: number): string {
  // Match the receipt's formatMoney style without re-importing it (we want
  // a plain string, no JSX). en-IN locale renders "1,15,000.00".
  return (paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

async function planNameFor(planId: string): Promise<string> {
  const [row] = await db
    .select({ name: plans.name })
    .from(plans)
    .where(eq(plans.id, planId))
    .limit(1);
  return row?.name ?? "Membership";
}

/**
 * Fire-and-forget receipt for a fresh enrolment or renewal. Does not throw —
 * notifications are non-blocking by design (the parent transaction has
 * already committed).
 */
export async function notifyEnrollmentOrRenewal(
  membership: Membership,
  payment: Payment,
  options: { isRenewal: boolean },
): Promise<void> {
  try {
    const planName = await planNameFor(membership.planId);
    await dispatchNotification({
      gymId: membership.gymId,
      branchId: membership.branchId,
      memberId: membership.memberId,
      eventType: options.isRenewal ? "renewal" : "enrollment",
      triggerEntityType: "membership",
      triggerEntityId: membership.id,
      templateVars: {
        plan_name: planName,
        start_date: formatCalendarDate(membership.startDate),
        end_date: formatCalendarDate(membership.endDate),
        amount: rupees(membership.finalAmountPaise),
        invoice_number: payment.invoiceNumber,
      },
    });
  } catch (err) {
    console.error("notifyEnrollmentOrRenewal failed", err);
  }
}

export async function notifyRefund(
  refundPayment: Payment,
  originalPayment: Payment,
  member: { id: string; gymId: string; branchId: string },
): Promise<void> {
  try {
    await dispatchNotification({
      gymId: member.gymId,
      branchId: member.branchId,
      memberId: member.id,
      eventType: "refund",
      triggerEntityType: "payment",
      triggerEntityId: refundPayment.id,
      templateVars: {
        amount: rupees(Math.abs(refundPayment.amountPaise)),
        original_invoice: originalPayment.invoiceNumber,
        refund_invoice: refundPayment.invoiceNumber,
        payment_mode:
          MODE_LABEL[refundPayment.paymentMode] ?? refundPayment.paymentMode,
      },
    });
  } catch (err) {
    console.error("notifyRefund failed", err);
  }
}

export async function notifyCorrection(
  membership: Membership,
  invoiceNumber: string,
): Promise<void> {
  try {
    const planName = await planNameFor(membership.planId);
    await dispatchNotification({
      gymId: membership.gymId,
      branchId: membership.branchId,
      memberId: membership.memberId,
      eventType: "correction",
      triggerEntityType: "membership",
      triggerEntityId: membership.id,
      templateVars: {
        plan_name: planName,
        amount: rupees(membership.finalAmountPaise),
        start_date: formatCalendarDate(membership.startDate),
        end_date: formatCalendarDate(membership.endDate),
        invoice_number: invoiceNumber,
      },
    });
  } catch (err) {
    console.error("notifyCorrection failed", err);
  }
}

export async function notifyCancellation(
  membership: Membership,
  options: {
    effectiveDate: string;
    refundAmountPaise?: number | null;
  },
): Promise<void> {
  try {
    const planName = await planNameFor(membership.planId);
    await dispatchNotification({
      gymId: membership.gymId,
      branchId: membership.branchId,
      memberId: membership.memberId,
      eventType: "cancellation",
      triggerEntityType: "membership",
      triggerEntityId: membership.id,
      templateVars: {
        plan_name: planName,
        effective_date: formatCalendarDate(options.effectiveDate),
        refund_amount:
          options.refundAmountPaise && options.refundAmountPaise > 0
            ? rupees(options.refundAmountPaise)
            : "",
      },
    });
  } catch (err) {
    console.error("notifyCancellation failed", err);
  }
}
