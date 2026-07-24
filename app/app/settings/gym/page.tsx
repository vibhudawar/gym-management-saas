import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { gyms } from "@/lib/db/schema/gyms";
import { requireRole } from "@/lib/auth/get-session";
import { GymProfileForm } from "./_components/gym-profile-form";

export const metadata: Metadata = { title: "Gym profile · Settings" };

export default async function GymSettingsPage() {
  const session = await requireRole("owner");
  const [gym] = await db
    .select()
    .from(gyms)
    .where(eq(gyms.id, session.gym.id))
    .limit(1);

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-foreground text-lg font-semibold tracking-tight">
          Gym profile
        </h2>
        <p className="text-muted-foreground text-xs">
          Name, invoice prefix, and tax details that show up on receipts.
        </p>
      </header>
      <div
        data-slot="card"
        className="bg-gradient-to-t from-primary/5 to-card text-card-foreground ring-foreground/10 dark:bg-card rounded-xl p-6 ring-1 shadow-xs"
      >
        <GymProfileForm
          initial={{
            name: gym.name,
            gstNumber: gym.gstNumber,
            invoicePrefix: gym.invoicePrefix,
            subscriptionTier: gym.subscriptionTier,
            currency: gym.currency,
            createdAt: gym.createdAt,
          }}
        />
      </div>
    </section>
  );
}
