import { ROLES } from "./landing-data";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

export function RolesSection() {
  return (
    <section className="border-t border-border bg-muted/30 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-6">
        <SectionHeading
          eyebrow="Roles & access"
          title="Each person sees only what they should"
          subtitle="Role-based access is enforced in the database, not just the interface — and every change is recorded."
        />

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {ROLES.map((role, i) => {
            const Icon = role.icon;
            return (
              <Reveal key={role.role} delay={i * 0.08}>
                <div className="h-full rounded-2xl border border-border bg-card p-6 shadow-xs">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </span>
                    <h3 className="text-base font-semibold text-foreground">
                      {role.role}
                    </h3>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    {role.body}
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
