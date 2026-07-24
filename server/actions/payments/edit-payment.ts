"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { paymentModes } from "@/lib/db/schema/payments";
import { requireRole } from "@/lib/auth/get-session";
import {
  editPaymentService,
  type EditPaymentResult,
} from "@/server/services/edit-payment";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const inputSchema = z.object({
  paymentId: z.string().uuid(),
  amountPaise: z.number().int().min(1).optional(),
  paymentMode: z.enum(paymentModes).optional(),
  paymentDate: isoDate.optional(),
  notes: z.string().trim().max(280).nullable().optional(),
  reason: z.string().trim().min(10).max(500),
});

export async function editPayment(input: unknown): Promise<EditPaymentResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_AMOUNT",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const session = await requireRole("owner");
  const result = await editPaymentService(session, parsed.data);
  if (result.ok) {
    revalidatePath("/app/members");
    revalidatePath("/app/payments");
  }
  return result;
}
