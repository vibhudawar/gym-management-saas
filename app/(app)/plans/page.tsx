import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/get-session";
import { isManagerOrOwner } from "@/lib/auth/roles";
import { listAddOns } from "@/server/queries/add-ons/list-add-ons";
import { listPlans } from "@/server/queries/plans/list-plans";
import { PlansPageClient } from "./_components/plans-page-client";

export const metadata: Metadata = { title: "Plans" };

export default async function PlansPage() {
  const session = await requireUser();
  const [plans, addOns] = await Promise.all([
    listPlans({ includeInactive: true }),
    listAddOns({ includeInactive: true }),
  ]);

  return (
    <PlansPageClient
      plans={plans}
      addOns={addOns}
      canEdit={isManagerOrOwner(session.user.role)}
    />
  );
}
