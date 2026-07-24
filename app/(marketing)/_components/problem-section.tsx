import { PROBLEMS } from "./landing-data";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

export function ProblemSection() {
  return (
    <section className="border-t border-border bg-muted/30 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-6">
        <SectionHeading
          eyebrow="The problem"
          title="The three ways gyms lose money"
          subtitle="Most gyms don't have a revenue problem — they have a tracking problem. Here is where the money goes."
        />

        <div className="mt-14 grid gap-5 sm:grid-cols-3">
          {PROBLEMS.map((problem, i) => {
            const Icon = problem.icon;
            return (
              <Reveal key={problem.title} delay={i * 0.08}>
                <div className="h-full rounded-2xl border border-border bg-card p-6 shadow-xs">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold text-foreground">
                    {problem.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {problem.body}
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
