import type { Metadata } from "next";
import { AnalyticsSection } from "./_components/analytics-section";
import { FinalCta } from "./_components/final-cta";
import { Hero } from "./_components/hero";
import { HowItWorks } from "./_components/how-it-works";
import { IndiaSection } from "./_components/india-section";
import { PricingSection } from "./_components/pricing-section";
import { ProblemSection } from "./_components/problem-section";
import { ProductShowcase } from "./_components/product-showcase";
import { RolesSection } from "./_components/roles-section";

export const metadata: Metadata = {
  title: "GymOS — Gym management software for Indian gyms",
  description:
    "GymOS replaces your paper register and Excel sheets. Manage members, collect payments, track every renewal, and follow up on WhatsApp — from one dashboard built for Indian gyms.",
};

export default function LandingPage() {
  return (
    <>
      <Hero />
      <ProblemSection />
      <ProductShowcase />
      <HowItWorks />
      <AnalyticsSection />
      <IndiaSection />
      <RolesSection />
      <PricingSection />
      <FinalCta />
    </>
  );
}
