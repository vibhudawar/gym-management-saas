"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema/users";
import { recordAudit } from "@/lib/auth/audit";
import { requireUser } from "@/lib/auth/get-session";
import { phoneSchema } from "@/lib/utils/phone";

const inputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: phoneSchema,
});

type Result = { ok: true } | { ok: false; error: string };

export async function updateAccount(input: unknown): Promise<Result> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const session = await requireUser();

  const [before] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!before) return { ok: false, error: "User not found." };

  const [after] = await db
    .update(users)
    .set({
      name: parsed.data.name,
      phone: parsed.data.phone,
    })
    .where(eq(users.id, session.user.id))
    .returning();

  await recordAudit({
    entityType: "user",
    entityId: after.id,
    branchId: after.branchId ?? null,
    action: "update",
    before,
    after: { ...after, _meta: { event: "self_update" } },
  });

  revalidatePath("/app/settings/account");
  return { ok: true };
}
