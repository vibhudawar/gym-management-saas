"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { paymentModes } from "@/lib/db/schema/payments";
import { requireRole } from "@/lib/auth/get-session";
import {
  recordRefundService,
  type RefundResult,
} from "@/server/services/refund";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const inputSchema = z.object({
  paymentId: z.string().uuid(),
  amountPaise: z.number().int().min(1),
  reason: z.string().trim().min(10).max(500),
  refundDate: isoDate,
  paymentMode: z.enum(paymentModes),
});

export async function recordRefund(input: unknown): Promise<RefundResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_REFUND_AMOUNT",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const session = await requireRole("owner");
  const result = await recordRefundService(session, parsed.data);
  if (result.ok) {
    revalidatePath("/members");
    revalidatePath("/payments");
  }
  return result;
}
