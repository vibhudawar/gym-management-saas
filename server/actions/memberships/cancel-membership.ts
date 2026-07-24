"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { paymentModes } from "@/lib/db/schema/payments";
import { requireRole } from "@/lib/auth/get-session";
import {
  cancelMembershipService,
  type CancelMembershipResult,
} from "@/server/services/cancel-membership";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const inputSchema = z.object({
  membershipId: z.string().uuid(),
  effectiveDate: isoDate,
  reason: z.string().trim().min(10).max(500),
  refund: z
    .object({
      paymentId: z.string().uuid(),
      amountPaise: z.number().int().min(1),
      paymentMode: z.enum(paymentModes),
      notes: z.string().trim().max(280).nullable().optional(),
    })
    .optional(),
  memberId: z.string().uuid().optional(),
});

export async function cancelMembership(
  input: unknown,
): Promise<CancelMembershipResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "REASON_TOO_SHORT",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const session = await requireRole("owner");
  const { memberId, ...payload } = parsed.data;
  const result = await cancelMembershipService(session, payload);
  if (result.ok) {
    revalidatePath("/app/members");
    revalidatePath("/app/payments");
    if (memberId) revalidatePath(`/app/members/${memberId}`);
  }
  return result;
}
