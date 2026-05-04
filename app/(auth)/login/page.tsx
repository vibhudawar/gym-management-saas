import type { Metadata } from "next";
import Link from "next/link";
import { AuthSplit } from "../_components/auth-split";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthSplit
      footer={
        <>
          By signing in, you agree to our{" "}
          <Link href="#" className="hover:text-foreground underline-offset-4 hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="#" className="hover:text-foreground underline-offset-4 hover:underline">
            Privacy Policy
          </Link>
          .
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            Welcome back
          </h1>
          <p className="text-muted-foreground text-balance text-sm">
            Use the staff account provisioned for your gym.
          </p>
        </div>
        <LoginForm />
        <div className="text-muted-foreground text-center text-xs">
          Don&rsquo;t have an account?{" "}
          <Link
            href="/signup"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Get in touch
          </Link>
        </div>
      </div>
    </AuthSplit>
  );
}
