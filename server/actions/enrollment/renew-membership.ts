"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { paymentModes } from "@/lib/db/schema/payments";
import { requireUser } from "@/lib/auth/get-session";
import {
  renew,
  type StartMode,
} from "@/server/services/renewal";
import type { EnrollmentResult } from "@/server/services/enrollment";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const inputSchema = z.object({
  memberId: z.string().uuid(),
  branchId: z.string().uuid(),
  planId: z.string().uuid(),
  appliedAddOnIds: z.array(z.string().uuid()).max(20),
  discountPaise: z.number().int().min(0),
  discountReason: z.string().trim().max(280).nullable(),
  finalAmountPaise: z.number().int().min(0),
  paymentMode: z.enum(paymentModes),
  paymentDate: isoDate,
  paymentNotes: z.string().trim().max(280).nullable(),
  startMode: z.enum(["from_today", "from_previous_end", "custom"]),
  customStartDate: isoDate.optional(),
});

export async function renewMembership(input: unknown): Promise<EnrollmentResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_PLAN",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const session = await requireUser();
  const result = await renew(session, {
    ...parsed.data,
    startMode: parsed.data.startMode as StartMode,
  });
  if (result.ok) {
    revalidatePath("/members");
    revalidatePath(`/members/${parsed.data.memberId}`);
    revalidatePath("/payments");
  }
  return result;
}
