import type { Metadata } from "next";
import { AuthSplit } from "../_components/auth-split";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Set a new password" };

export default function ResetPasswordPage() {
  return (
    <AuthSplit>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            Choose a new password
          </h1>
          <p className="text-muted-foreground text-balance text-sm">
            You&rsquo;ll be signed in automatically afterwards.
          </p>
        </div>
        <ResetPasswordForm />
      </div>
    </AuthSplit>
  );
}
