import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { demoMailto, PRICING } from "./landing-data";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

export function PricingSection() {
  return (
    <section
      id="pricing"
      className="border-t border-border bg-muted/30 py-20 sm:py-28"
    >
      <div className="mx-auto w-full max-w-6xl px-6">
        <SectionHeading
          eyebrow="Pricing"
          title="Straightforward monthly pricing"
          subtitle="No setup fees. No per-member charges. Start on Basic and upgrade when you want automation."
        />

        <div className="mx-auto mt-14 grid max-w-4xl gap-5 md:grid-cols-2">
          {PRICING.map((tier, i) => (
            <Reveal key={tier.name} delay={i * 0.08}>
              <div
                className={cn(
                  "relative flex h-full flex-col rounded-2xl border p-7 shadow-xs",
                  tier.featured
                    ? "border-primary bg-gradient-to-t from-primary/5 to-card ring-1 ring-primary"
                    : "border-border bg-card",
                )}
              >
                {tier.featured ? (
                  <span className="absolute -top-3 right-6 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                    Most popular
                  </span>
                ) : null}
                <h3 className="text-lg font-semibold text-foreground">
                  {tier.name}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {tier.tagline}
                </p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold tracking-tight text-foreground">
                    {tier.price}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {tier.cadence}
                  </span>
                </div>

                <ul className="mt-6 flex-1 space-y-3">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span className="text-foreground">{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  size="lg"
                  variant={tier.featured ? "default" : "outline"}
                  className="mt-7 h-11 w-full text-sm"
                >
                  <a href={demoMailto}>Book a demo</a>
                </Button>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
