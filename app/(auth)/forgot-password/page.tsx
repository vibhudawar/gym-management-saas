import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="bg-card w-full max-w-sm rounded-xl border p-6 shadow-sm">
      <div className="mb-5 space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          Reset your password
        </h1>
        <p className="text-muted-foreground text-sm">
          We&rsquo;ll email you a link to set a new password.
        </p>
      </div>
      <ForgotPasswordForm />
      <p className="text-muted-foreground mt-4 text-center text-xs">
        <Link
          href="/login"
          className="hover:text-foreground underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
