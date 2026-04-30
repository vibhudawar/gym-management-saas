"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";

const signInSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1, "Password is required"),
});

export type SignInResult =
  | { ok: true }
  | { ok: false; error: string; code?: string };

export async function signIn(input: unknown): Promise<SignInResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid email and password.", code: "validation" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return {
      ok: false,
      error: "Email or password is incorrect.",
      code: error.code ?? "auth_failed",
    };
  }

  return { ok: true };
}
