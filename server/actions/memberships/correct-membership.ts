"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { paymentModes } from "@/lib/db/schema/payments";
import { requireUser } from "@/lib/auth/get-session";
import {
  correctMembershipService,
  type CorrectMembershipResult,
} from "@/server/services/correct-membership";

const inputSchema = z.object({
  membershipId: z.string().uuid(),
  planId: z.string().uuid(),
  appliedAddOnIds: z.array(z.string().uuid()).max(20),
  discountPaise: z.number().int().min(0),
  discountReason: z.string().trim().max(280).nullable(),
  paymentMode: z.enum(paymentModes),
  reason: z.string().trim().min(10).max(500),
  memberId: z.string().uuid().optional(), // for revalidatePath only
});

export async function correctMembership(
  input: unknown,
): Promise<CorrectMembershipResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_PLAN",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const session = await requireUser();
  const { memberId, ...payload } = parsed.data;
  const result = await correctMembershipService(session, payload);
  if (result.ok) {
    revalidatePath("/members");
    revalidatePath("/payments");
    if (memberId) revalidatePath(`/members/${memberId}`);
  }
  return result;
}
