"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { demoMailto, demoWhatsapp } from "./landing-data";
import { HeroCreative } from "./hero-creative";

const EASE: [number, number, number, number] = [0.22, 0.8, 0.2, 1];

export function Hero() {
  const reduce = useReducedMotion();
  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: EASE },
        };

  return (
    <section className="relative overflow-hidden">
      {/* soft blue glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[-10%] mx-auto h-[420px] max-w-4xl rounded-full bg-primary/10 blur-3xl"
      />
      <div className="relative mx-auto w-full max-w-6xl px-6 pt-16 pb-10 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <motion.a
            href="#how"
            {...rise(0)}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur"
          >
            <span className="flex size-1.5 rounded-full bg-emerald-500" />
            Built for Indian gyms — replaces the paper register
          </motion.a>

          <motion.h1
            {...rise(0.08)}
            className="mt-6 text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl"
          >
            Gym management software that stops revenue slipping through the
            cracks.
          </motion.h1>

          <motion.p
            {...rise(0.16)}
            className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            GymOS replaces your paper register and Excel sheets. Manage members,
            collect payments, track every renewal, and follow up on WhatsApp —
            from one dashboard built for Indian gyms.
          </motion.p>

          <motion.div
            {...rise(0.24)}
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Button asChild size="lg" className="h-11 px-6 text-sm">
              <a href={demoMailto}>
                Book a demo
                <ArrowRight className="size-4" />
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-11 px-6 text-sm"
            >
              <a href="#how">
                <PlayCircle className="size-4" />
                See how it works
              </a>
            </Button>
          </motion.div>

          <motion.p {...rise(0.3)} className="mt-4 text-xs text-muted-foreground">
            No credit card required · We set up your gym for you ·{" "}
            <a
              href={demoWhatsapp}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Chat on WhatsApp
            </a>
          </motion.p>
        </div>

        <motion.div
          {...(reduce
            ? {}
            : {
                initial: { opacity: 0, y: 30, scale: 0.98 },
                animate: { opacity: 1, y: 0, scale: 1 },
                transition: { duration: 0.7, delay: 0.35, ease: EASE },
              })}
          className="mx-auto mt-14 max-w-5xl rounded-3xl border border-border bg-card p-2 shadow-2xl shadow-primary/5 sm:p-3"
        >
          <HeroCreative />
        </motion.div>
      </div>
    </section>
  );
}
