"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { paymentModes } from "@/lib/db/schema/payments";
import { requireUser } from "@/lib/auth/get-session";
import { enroll, type EnrollmentResult } from "@/server/services/enrollment";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const inputSchema = z.object({
  memberId: z.string().uuid(),
  branchId: z.string().uuid(),
  planId: z.string().uuid(),
  startDate: isoDate,
  appliedAddOnIds: z.array(z.string().uuid()).max(20),
  discountPaise: z.number().int().min(0),
  discountReason: z.string().trim().max(280).nullable(),
  finalAmountPaise: z.number().int().min(0),
  paymentMode: z.enum(paymentModes),
  paymentDate: isoDate,
  paymentNotes: z.string().trim().max(280).nullable(),
});

export async function enrollNewMember(input: unknown): Promise<EnrollmentResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_PLAN",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const session = await requireUser();
  const result = await enroll(session, parsed.data);
  if (result.ok) {
    revalidatePath("/app/members");
    revalidatePath(`/app/members/${parsed.data.memberId}`);
    revalidatePath("/app/payments");
  }
  return result;
}
