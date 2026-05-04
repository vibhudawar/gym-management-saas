import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { branches } from "@/lib/db/schema/branches";
import { requireUser } from "@/lib/auth/get-session";
import { AccountForm } from "./_components/account-form";
import { PasswordForm } from "./_components/password-form";

export const metadata: Metadata = { title: "Account · Settings" };

export default async function AccountSettingsPage() {
  const session = await requireUser();
  let branchName: string | null = null;
  if (session.user.branchId) {
    const [b] = await db
      .select({ name: branches.name })
      .from(branches)
      .where(eq(branches.id, session.user.branchId))
      .limit(1);
    branchName = b?.name ?? null;
  }

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-foreground text-lg font-semibold tracking-tight">
          Account
        </h2>
        <p className="text-muted-foreground text-xs">
          Your profile and password. Changes here only affect your own account.
        </p>
      </header>
      <div
        data-slot="card"
        className="bg-gradient-to-t from-primary/5 to-card text-card-foreground ring-foreground/10 dark:bg-card rounded-xl p-6 ring-1 shadow-xs"
      >
        <h3 className="text-foreground mb-4 text-sm font-semibold">Profile</h3>
        <AccountForm
          initial={{
            name: session.user.name,
            phone: session.user.phone,
            email: session.email,
            role: session.user.role,
            branchName,
          }}
        />
      </div>
      <div
        data-slot="card"
        className="bg-gradient-to-t from-primary/5 to-card text-card-foreground ring-foreground/10 dark:bg-card rounded-xl p-6 ring-1 shadow-xs"
      >
        <h3 className="text-foreground mb-1 text-sm font-semibold">Password</h3>
        <p className="text-muted-foreground mb-4 text-xs">
          You&rsquo;ll need your current password to change it.
        </p>
        <PasswordForm />
      </div>
    </section>
  );
}
