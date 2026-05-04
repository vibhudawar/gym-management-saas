import type { Metadata } from "next";
import Link from "next/link";
import { AuthSplit } from "../_components/auth-split";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthSplit>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            Reset your password
          </h1>
          <p className="text-muted-foreground text-balance text-sm">
            We&rsquo;ll email you a link to set a new password.
          </p>
        </div>
        <ForgotPasswordForm />
        <div className="text-muted-foreground text-center text-xs">
          <Link
            href="/login"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </AuthSplit>
  );
}
