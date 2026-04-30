"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";

const resetSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters."),
    confirm: z.string().min(8),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "Passwords do not match.",
  });

export type ResetPasswordResult =
  | { ok: true }
  | { ok: false; error: string; code?: string };

export async function resetPassword(input: unknown): Promise<ResetPasswordResult> {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Invalid input.", code: "validation" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return {
      ok: false,
      error: "Could not update password. The reset link may have expired.",
      code: error.code ?? "update_failed",
    };
  }

  return { ok: true };
}
