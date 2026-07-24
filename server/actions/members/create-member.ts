"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { memberCreateSchema, type Member } from "@/lib/db/schema/members";
import { paymentModes } from "@/lib/db/schema/payments";
import { requireUser } from "@/lib/auth/get-session";
import { createMemberAndEnroll } from "@/server/services/create-and-enroll";
import { db } from "@/lib/db";
import { members } from "@/lib/db/schema/members";
import { eq } from "drizzle-orm";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const enrollmentInputSchema = z.object({
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

const inputSchema = z.object({
  member: memberCreateSchema,
  enrollment: enrollmentInputSchema.optional(),
});

export type CreateMemberResult =
  | {
      ok: true;
      data: Member;
      enrolled: boolean;
      membershipId?: string;
      paymentId?: string;
      invoiceNumber?: string;
    }
  | {
      ok: false;
      error: string;
      code?: string;
      existing?: { id: string; name: string; branchName: string };
    };

export async function createMember(input: unknown): Promise<CreateMemberResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue?.message ?? "Invalid input",
      code: "validation",
    };
  }

  const session = await requireUser();
  const result = await createMemberAndEnroll(session, parsed.data);

  if (!result.ok) {
    return {
      ok: false,
      error: result.message,
      code: result.code.toLowerCase(),
      existing: result.existing,
    };
  }

  // Fetch the freshly-inserted member row to keep the response shape stable.
  const [row] = await db
    .select()
    .from(members)
    .where(eq(members.id, result.memberId))
    .limit(1);

  revalidatePath("/app/members");
  if (result.enrolled) {
    revalidatePath(`/app/members/${result.memberId}`);
    revalidatePath("/app/payments");
  }

  return {
    ok: true,
    data: row,
    enrolled: result.enrolled,
    membershipId: result.membershipId,
    paymentId: result.paymentId,
    invoiceNumber: result.invoiceNumber,
  };
}
