import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Set a new password" };

export default function ResetPasswordPage() {
  return (
    <div className="bg-card w-full max-w-sm rounded-xl border p-6 shadow-sm">
      <div className="mb-5 space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          Choose a new password
        </h1>
        <p className="text-muted-foreground text-sm">
          You&rsquo;ll be signed in automatically afterwards.
        </p>
      </div>
      <ResetPasswordForm />
    </div>
  );
}
