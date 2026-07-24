import { Check } from "lucide-react";
import { INDIA_TAGS } from "./landing-data";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

export function IndiaSection() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-6">
        <SectionHeading
          eyebrow="Built for India"
          title="Made for how Indian gyms actually run"
          subtitle="Rupees, GST, WhatsApp, and multi-branch — handled the right way from day one."
        />

        <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {INDIA_TAGS.map((tag, i) => {
            const Icon = tag.icon;
            return (
              <Reveal key={tag.label} delay={(i % 4) * 0.06}>
                <div className="flex h-full items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </span>
                  <p className="text-sm font-medium leading-snug text-foreground">
                    {tag.label}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={0.1} className="mt-6">
          <p className="flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <Check className="size-4 text-emerald-600" />
            Data hosted in Mumbai (ap-south-1) · timestamps in IST
          </p>
        </Reveal>
      </div>
    </section>
  );
}
