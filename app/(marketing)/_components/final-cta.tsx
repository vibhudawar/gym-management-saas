import { ArrowRight, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CONTACT, demoMailto, demoWhatsapp } from "./landing-data";
import { Reveal } from "./reveal";

export function FinalCta() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-border bg-primary px-6 py-14 text-center sm:px-12 sm:py-20">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,white,transparent_40%),radial-gradient(circle_at_80%_60%,white,transparent_35%)]"
            />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="text-balance text-3xl font-semibold tracking-tight text-primary-foreground sm:text-4xl">
                Stop chasing renewals. Start keeping members.
              </h2>
              <p className="mx-auto mt-4 text-pretty text-base leading-relaxed text-primary-foreground/80 sm:text-lg">
                Bring your gym&apos;s records, payments, and renewals into one
                place. We&apos;ll set up your gym for you — no credit card
                required.
              </p>

              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  variant="secondary"
                  className="h-11 px-6 text-sm"
                >
                  <a href={demoMailto}>
                    <Mail className="size-4" />
                    Book a demo
                    <ArrowRight className="size-4" />
                  </a>
                </Button>
                <Button
                  asChild
                  size="lg"
                  className="h-11 border border-primary-foreground/30 bg-primary-foreground/10 px-6 text-sm text-primary-foreground hover:bg-primary-foreground/20"
                >
                  <a href={demoWhatsapp}>
                    <MessageCircle className="size-4" />
                    Chat on WhatsApp
                  </a>
                </Button>
              </div>

              <p className="mt-6 text-sm text-primary-foreground/70">
                Or email us at{" "}
                <a
                  href={demoMailto}
                  className="font-medium text-primary-foreground underline underline-offset-4"
                >
                  {CONTACT.email}
                </a>
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
