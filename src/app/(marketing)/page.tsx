import { Hero } from "@/components/landing/Hero";
import { ModelRow } from "@/components/landing/ModelRow";
import { CanvasBento } from "@/components/landing/CanvasBento";
import { RunsSection } from "@/components/landing/RunsSection";
import { Examples } from "@/components/landing/Examples";
import { PricingStrip } from "@/components/landing/PricingStrip";
import { ClosingPanel } from "@/components/landing/ClosingPanel";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <ModelRow />
      <CanvasBento />
      <RunsSection />
      <Examples />
      <PricingStrip />
      <ClosingPanel />
    </>
  );
}
