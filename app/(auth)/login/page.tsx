import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="bg-card w-full max-w-sm rounded-xl border p-6 shadow-sm">
      <div className="mb-5 space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-muted-foreground text-sm">
          Use the staff account provisioned for your gym.
        </p>
      </div>
      <LoginForm />
      <p className="text-muted-foreground mt-4 text-center text-xs">
        <Link
          href="/forgot-password"
          className="hover:text-foreground underline-offset-4 hover:underline"
        >
          Forgot password?
        </Link>
      </p>
    </div>
  );
}
