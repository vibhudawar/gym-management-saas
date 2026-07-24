import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { branches } from "@/lib/db/schema/branches";
import { requireRole } from "@/lib/auth/get-session";
import { BranchesList } from "./_components/branches-list";

export const metadata: Metadata = { title: "Branches · Settings" };

export default async function BranchesSettingsPage() {
  const session = await requireRole("owner");
  const rows = await db
    .select({
      id: branches.id,
      name: branches.name,
      address: branches.address,
      phone: branches.phone,
      isActive: branches.isActive,
      deletedAt: branches.deletedAt,
      createdAt: branches.createdAt,
    })
    .from(branches)
    .where(eq(branches.gymId, session.gym.id))
    .orderBy(asc(branches.name));
  void and;

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-foreground text-lg font-semibold tracking-tight">
          Branches
        </h2>
        <p className="text-muted-foreground text-xs">
          Add, rename, and deactivate branches. Active members and staff
          must be moved before deactivating a branch.
        </p>
      </header>
      <BranchesList rows={rows} />
    </section>
  );
}
