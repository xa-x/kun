import { HeroActions } from "./HeroActions";
import { HeroCanvas } from "./HeroCanvas";

/**
 * Asymmetric hero: the promise on the left, the product on the right, bleeding
 * past the edge of the container so the canvas reads as larger than the page.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* canvas dot grid, fading out toward the edges */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70 [mask-image:radial-gradient(70%_60%_at_65%_45%,black,transparent)]"
        style={{
          backgroundImage:
            "radial-gradient(var(--color-line2) 1.2px, transparent 1.2px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative mx-auto grid w-full max-w-[1440px] items-center gap-10 px-5 pb-16 pt-14 md:px-8 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-[minmax(0,4.4fr)_minmax(0,7.6fr)] lg:gap-8 lg:pb-20 lg:pt-16">
        <div className="max-w-[34rem]">
          <h1 className="text-[clamp(2.6rem,5.4vw,4.6rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-ink">
            The AI canvas that keeps running.
          </h1>
          <p className="mt-6 max-w-[30rem] text-[17px] leading-relaxed text-muted">
            Wire text, image, audio and video models together, then schedule,
            share and call the result from anywhere.
          </p>
          <div className="mt-9">
            <HeroActions />
          </div>
        </div>

        <div className="min-w-0">
          <HeroCanvas />
        </div>
      </div>
    </section>
  );
}
