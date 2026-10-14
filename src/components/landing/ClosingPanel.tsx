import Image from "next/image";
import { getT } from "@/lib/i18n/server";
import { HeroActions } from "./HeroActions";
import { Reveal } from "./Reveal";

/**
 * The name is the pitch: كُن means "Be!", the command that makes a thing
 * exist. The panel is a photograph, so its text is always light.
 */
export async function ClosingPanel() {
  const { t } = await getT();
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
            className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/50 to-black/10 rtl:bg-gradient-to-l"
            aria-hidden
          />

          <div className="flex min-h-[460px] flex-col justify-between gap-10 p-8 md:p-14 lg:flex-row lg:items-end">
            <div className="flex flex-col justify-end">
              <p
                lang="ar"
                className="font-arabic text-start text-[clamp(6rem,17vw,14rem)] font-bold leading-[0.95] text-white"
              >
                كُن
              </p>
              <p className="mt-2 text-[clamp(1.5rem,2.6vw,2.4rem)] font-semibold tracking-tight text-white">
                {t("site.closing.be")}
              </p>
              <p className="mt-3 max-w-md text-[16px] leading-relaxed text-white/75">
                {t("site.closing.body")}
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
