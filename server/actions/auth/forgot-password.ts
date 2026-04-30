"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";

const forgotSchema = z.object({
  email: z.string().trim().email(),
});

export type ForgotPasswordResult =
  | { ok: true }
  | { ok: false; error: string; code?: string };

export async function requestPasswordReset(
  input: unknown,
): Promise<ForgotPasswordResult> {
  const parsed = forgotSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid email.", code: "validation" };
  }

  const supabase = await createSupabaseServerClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${appUrl}/reset-password`,
  });

  if (error) {
    // Generic response — never reveal whether the email exists.
    console.error("resetPasswordForEmail failed", error);
  }

  return { ok: true };
}
