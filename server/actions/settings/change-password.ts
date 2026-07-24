"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAudit } from "@/lib/auth/audit";
import { requireUser } from "@/lib/auth/get-session";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";

const inputSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters"),
});

type Result = { ok: true } | { ok: false; error: string; code?: string };

/**
 * Two-step pattern per Pitfall #4: verify current via signInWithPassword,
 * then updateUser. Skipping the verify step is a security hole — anyone
 * who hijacks a session would be able to change the password without
 * knowing the current one.
 *
 * The audit row records *that* a password changed, never the values.
 */
export async function changePassword(input: unknown): Promise<Result> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const session = await requireUser();
  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return { ok: false, error: "New password must differ from current." };
  }

  const supabase = await createSupabaseServerClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: session.email,
    password: parsed.data.currentPassword,
  });
  if (signInError) {
    return { ok: false, error: "Current password is incorrect." };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  });
  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  await recordAudit({
    entityType: "user",
    entityId: session.user.id,
    branchId: session.user.branchId ?? null,
    action: "update",
    after: {
      _meta: { event: "password_changed", at: new Date().toISOString() },
    },
  });

  revalidatePath("/app/settings/account");
  return { ok: true };
}
