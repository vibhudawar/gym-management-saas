import { PILLARS } from "./landing-data";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

export function HowItWorks() {
  return (
    <section id="how" className="border-t border-border bg-muted/30 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-6">
        <SectionHeading
          eyebrow="How it works"
          title="Set up in minutes, run it daily"
          subtitle="Three jobs, one dashboard — enroll, remind, and recover."
        />

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {PILLARS.map((pillar, i) => {
            const Icon = pillar.icon;
            return (
              <Reveal key={pillar.step} delay={i * 0.08}>
                <div className="relative h-full rounded-2xl border border-border bg-card p-6 shadow-xs">
                  <span className="text-sm font-semibold tabular-nums text-primary/40">
                    {pillar.step}
                  </span>
                  <span className="mt-3 flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold text-foreground">
                    {pillar.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {pillar.body}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
