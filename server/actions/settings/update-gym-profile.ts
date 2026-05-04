"use server";

import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { gyms } from "@/lib/db/schema/gyms";
import { payments } from "@/lib/db/schema/payments";
import { recordAudit } from "@/lib/auth/audit";
import { requireRole } from "@/lib/auth/get-session";
import {
  GSTIN_PATTERN,
  INVOICE_PREFIX_PATTERN,
} from "@/lib/constants/validation";

const inputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  gstNumber: z
    .string()
    .trim()
    .regex(GSTIN_PATTERN, "Enter a valid 15-character GSTIN")
    .nullable()
    .optional(),
  invoicePrefix: z
    .string()
    .trim()
    .regex(INVOICE_PREFIX_PATTERN, "Use 2–10 uppercase letters, digits, or hyphens"),
  acknowledgeInvoicePrefixChange: z.boolean().optional(),
});

type Result =
  | { ok: true }
  | { ok: false; error: string; code?: string; existingInvoiceCount?: number };

export async function updateGymProfile(input: unknown): Promise<Result> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      code: "validation",
    };
  }
  const session = await requireRole("owner");

  const [before] = await db
    .select()
    .from(gyms)
    .where(eq(gyms.id, session.gym.id))
    .limit(1);
  if (!before) return { ok: false, error: "Gym not found." };

  const normalizedGst = parsed.data.gstNumber
    ? parsed.data.gstNumber.toUpperCase()
    : null;

  // Confirm prefix change when invoices already exist — owner must
  // acknowledge that old invoices keep their prefix.
  if (
    parsed.data.invoicePrefix !== before.invoicePrefix &&
    !parsed.data.acknowledgeInvoicePrefixChange
  ) {
    const [{ value: existing }] = await db
      .select({ value: count() })
      .from(payments)
      .where(eq(payments.gymId, session.gym.id));
    if (existing > 0) {
      return {
        ok: false,
        code: "INVOICE_PREFIX_CONFIRM",
        error:
          "Existing invoices keep their current prefix. New invoices will use the new prefix.",
        existingInvoiceCount: existing,
      };
    }
  }

  const [after] = await db
    .update(gyms)
    .set({
      name: parsed.data.name,
      gstNumber: normalizedGst,
      invoicePrefix: parsed.data.invoicePrefix,
    })
    .where(eq(gyms.id, session.gym.id))
    .returning();

  await recordAudit({
    entityType: "gym",
    entityId: after.id,
    branchId: null,
    action: "update",
    before,
    after: {
      ...after,
      _meta:
        parsed.data.invoicePrefix !== before.invoicePrefix
          ? {
              previousPrefix: before.invoicePrefix,
              newPrefix: parsed.data.invoicePrefix,
            }
          : undefined,
    },
  });

  revalidatePath("/settings/gym");
  revalidatePath("/", "layout");
  return { ok: true };
}
