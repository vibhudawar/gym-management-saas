import type { Metadata } from "next";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/get-session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Subscription · Settings" };

const BASIC_FEATURES = [
  "All core features",
  "SMS receipts to members",
  "Unlimited members",
  "Multi-branch support",
];

const PRO_FEATURES = [
  "Everything in Basic",
  "WhatsApp receipts (richer engagement)",
  "Automated renewal campaigns",
  "Lapsed member win-back flows",
  "Priority support",
];

const SUPPORT_EMAIL = "support@example.com";

export default async function SubscriptionSettingsPage() {
  const session = await requireRole("owner");
  const tier = session.gym.subscriptionTier;
  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-foreground text-lg font-semibold tracking-tight">
          Subscription
        </h2>
        <p className="text-muted-foreground text-xs">
          Your plan and what comes with it. Contact us when you&rsquo;re ready to upgrade.
        </p>
      </header>

      <PlanCard
        title="Basic"
        price="Current plan"
        features={BASIC_FEATURES}
        active={tier === "basic"}
      />
      <PlanCard
        title="Pro"
        price="₹5,000/month"
        features={PRO_FEATURES}
        active={tier === "pro"}
        cta={
          tier !== "pro" ? (
            <Button asChild variant="outline">
              <a href={`mailto:${SUPPORT_EMAIL}?subject=Upgrade%20to%20Pro`}>
                Contact us to upgrade
              </a>
            </Button>
          ) : null
        }
      />
    </section>
  );
}

function PlanCard({
  title,
  price,
  features,
  active,
  cta,
}: {
  title: string;
  price: string;
  features: string[];
  active: boolean;
  cta?: React.ReactNode;
}) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-gradient-to-t from-primary/5 to-card text-card-foreground ring-foreground/10 dark:bg-card rounded-xl p-5 ring-1 shadow-xs",
        active && "ring-primary/40",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h3 className="text-foreground text-base font-semibold tracking-tight">
            {title}
          </h3>
          <p className="text-muted-foreground text-xs">{price}</p>
        </div>
        {active ? <Badge variant="secondary">Active</Badge> : null}
      </div>
      <ul className="mt-3 space-y-1.5">
        {features.map((f) => (
          <li
            key={f}
            className="text-foreground/90 flex items-start gap-2 text-xs"
          >
            <Check className="text-primary mt-0.5 size-3.5 shrink-0" />
            {f}
          </li>
        ))}
      </ul>
      {cta ? <div className="mt-4">{cta}</div> : null}
    </div>
  );
}
