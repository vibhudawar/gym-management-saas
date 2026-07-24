import { AppScreen, AppScreenCompact } from "./app-screen";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

export function ProductShowcase() {
  return (
    <section id="features" className="py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-6">
        <SectionHeading
          eyebrow="Your home screen"
          title="Everything you run the gym on, in one view"
          subtitle="The day's revenue, new members, and exactly who to follow up with — nothing you don't need."
        />
      </div>

      <Reveal delay={0.05} className="mt-14">
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6">
          {/* full-HD screenshot on large screens; readable stacked mock below */}
          <div className="hidden lg:block">
            <AppScreen />
          </div>
          <div className="mx-auto max-w-md lg:hidden">
            <AppScreenCompact />
          </div>
        </div>
      </Reveal>
    </section>
  );
}
