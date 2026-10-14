import Image from "next/image";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n";
import { Reveal } from "./Reveal";

const TYPES: { key: MessageKey; color: string }[] = [
  { key: "site.bento.type.text", color: "var(--color-t-text)" },
  { key: "site.bento.type.image", color: "var(--color-t-image)" },
  { key: "site.bento.type.audio", color: "var(--color-t-audio)" },
  { key: "site.bento.type.video", color: "var(--color-t-video)" },
];

function Caption({ title, body }: { title: string; body: string }) {
  return (
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 pt-24">
      <h3 className="text-[19px] font-semibold tracking-tight text-white">
        {title}
      </h3>
      <p className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-white/75">
        {body}
      </p>
    </div>
  );
}

/**
 * Five cells for five ideas, shaped by what each one needs to show: three
 * media types get photographs, text gets typography, wiring gets its legend.
 */
export async function CanvasBento() {
  const { t } = await getT();
  return (
    <section
      id="how"
      className="mx-auto w-full max-w-[1440px] scroll-mt-20 px-5 py-24 md:px-8 md:py-28"
    >
      <Reveal>
        <h2 className="max-w-2xl text-[clamp(2rem,3.6vw,3.2rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-ink">
          {t("site.bento.title")}
        </h2>
        <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted">
          {t("site.bento.body")}
        </p>
      </Reveal>

      <Reveal className="mt-14" delay={0.1}>
        <div className="grid gap-4 md:grid-cols-12 md:grid-rows-[300px_300px_auto]">
          <article className="kun-photo relative min-h-[380px] md:col-span-5 md:row-span-2">
            <Image
              src="/landing/bento-glass.jpg"
              alt={t("site.bento.image.alt")}
              fill
              sizes="(min-width: 768px) 40vw, 100vw"
              className="object-cover"
            />
            <Caption
              title={t("site.bento.image.title")}
              body={t("site.bento.image.body")}
            />
          </article>

          <article className="kun-photo relative min-h-[300px] md:col-span-7">
            <Image
              src="/landing/bento-video.jpg"
              alt={t("site.bento.video.alt")}
              fill
              sizes="(min-width: 768px) 55vw, 100vw"
              className="object-cover object-[50%_100%]"
            />
            <Caption
              title={t("site.bento.video.title")}
              body={t("site.bento.video.body")}
            />
          </article>

          <article className="kun-photo relative min-h-[300px] md:col-span-3">
            <Image
              src="/landing/bento-mic.jpg"
              alt={t("site.bento.speech.alt")}
              fill
              sizes="(min-width: 768px) 25vw, 100vw"
              className="object-cover object-[50%_30%]"
            />
            <Caption
              title={t("site.bento.speech.title")}
              body={t("site.bento.speech.body")}
            />
          </article>

          <article className="kun-photo relative flex min-h-[300px] flex-col justify-between bg-card p-6 md:col-span-4">
            <p dir="auto" className="text-[clamp(1.25rem,1.8vw,1.6rem)] font-medium leading-snug tracking-tight text-ink">
              {t("site.bento.text.sample")}
            </p>
            <div>
              <h3 className="text-[19px] font-semibold tracking-tight text-ink">
                {t("site.bento.text.title")}
              </h3>
              <p className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-muted">
                {t("site.bento.text.body")}
              </p>
            </div>
          </article>

          <article className="kun-photo relative flex flex-col justify-between gap-6 bg-card px-6 py-6 md:col-span-12 md:flex-row md:items-center md:gap-10 md:px-8">
            <div className="max-w-md">
              <h3 className="text-[19px] font-semibold tracking-tight text-ink">
                {t("site.bento.ports.title")}
              </h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
                {t("site.bento.ports.body")}
              </p>
            </div>
            <ul className="flex flex-wrap gap-2.5">
              {TYPES.map((ty) => (
                <li
                  key={ty.key}
                  className="flex items-center gap-2.5 rounded-full border border-line2 bg-sunken px-4 py-2 text-[14px] text-ink"
                >
                  <span
                    className="h-3 w-3 rounded-full border-2 border-card"
                    style={{ background: ty.color, outline: `2px solid ${ty.color}` }}
                    aria-hidden
                  />
                  {t(ty.key)}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </Reveal>
    </section>
  );
}
