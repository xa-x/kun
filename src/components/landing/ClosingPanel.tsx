import Image from "next/image";
import { HeroActions } from "./HeroActions";
import { Reveal } from "./Reveal";

/**
 * The name is the pitch: كُن means "Be!", the command that makes a thing
 * exist. The panel is a photograph, so its text is always light.
 */
export function ClosingPanel() {
  return (
    <section className="mx-auto w-full max-w-[1440px] px-5 pb-24 md:px-8 md:pb-32">
      <Reveal>
        <div className="kun-photo relative isolate min-h-[460px]">
          <Image
            src="/landing/hero-lighthouse.jpg"
            alt=""
            fill
            sizes="100vw"
            className="-z-10 object-cover"
          />
          <div
            className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/50 to-black/10"
            aria-hidden
          />

          <div className="flex min-h-[460px] flex-col justify-between gap-10 p-8 md:p-14 lg:flex-row lg:items-end">
            <div className="flex flex-col justify-end">
              <p
                lang="ar"
                dir="rtl"
                className="font-arabic text-left text-[clamp(6rem,17vw,14rem)] font-bold leading-[0.95] text-white"
              >
                كُن
              </p>
              <p className="mt-2 text-[clamp(1.5rem,2.6vw,2.4rem)] font-semibold tracking-tight text-white">
                Be.
              </p>
              <p className="mt-3 max-w-md text-[16px] leading-relaxed text-white/75">
                The word that makes a thing exist. Say what you want, wire it
                up, and let it run.
              </p>
            </div>
            <div className="lg:pb-3">
              <HeroActions tone="onImage" />
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
