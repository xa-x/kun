import Image from "next/image";
import { Reveal } from "./Reveal";

const TYPES = [
  { name: "Text", color: "var(--color-t-text)" },
  { name: "Image", color: "var(--color-t-image)" },
  { name: "Audio", color: "var(--color-t-audio)" },
  { name: "Video", color: "var(--color-t-video)" },
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
export function CanvasBento() {
  return (
    <section
      id="how"
      className="mx-auto w-full max-w-[1440px] scroll-mt-20 px-5 py-24 md:px-8 md:py-28"
    >
      <Reveal>
        <h2 className="max-w-2xl text-[clamp(2rem,3.6vw,3.2rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-ink">
          One canvas for every medium.
        </h2>
        <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted">
          Text, image, audio and video models share typed ports, so anything
          that fits, connects.
        </p>
      </Reveal>

      <Reveal className="mt-14" delay={0.1}>
        <div className="grid gap-4 md:grid-cols-12 md:grid-rows-[300px_300px_auto]">
          <article className="kun-photo relative min-h-[380px] md:col-span-5 md:row-span-2">
            <Image
              src="/landing/bento-glass.jpg"
              alt="A glass sphere on wet black stone, refracting a tiny city skyline"
              fill
              sizes="(min-width: 768px) 40vw, 100vw"
              className="object-cover"
            />
            <Caption
              title="Image"
              body="Seedream, FLUX and Gemini Image. Hand a model a reference and it edits instead of starting over."
            />
          </article>

          <article className="kun-photo relative min-h-[300px] md:col-span-7">
            <Image
              src="/landing/bento-video.jpg"
              alt="A paper boat on a mirror-still lake at dawn"
              fill
              sizes="(min-width: 768px) 55vw, 100vw"
              className="object-cover object-[50%_100%]"
            />
            <Caption
              title="Video"
              body="Seedance, Veo, Kling and Sora. Long jobs run in the background and report back when they land."
            />
          </article>

          <article className="kun-photo relative min-h-[300px] md:col-span-3">
            <Image
              src="/landing/bento-mic.jpg"
              alt="A vintage ribbon microphone in a dim studio"
              fill
              sizes="(min-width: 768px) 25vw, 100vw"
              className="object-cover object-[50%_30%]"
            />
            <Caption title="Speech" body="Text to voice through any speech model." />
          </article>

          <article className="kun-photo relative flex min-h-[300px] flex-col justify-between bg-card p-6 md:col-span-4">
            <p className="text-[clamp(1.25rem,1.8vw,1.6rem)] font-medium leading-snug tracking-tight text-ink">
              Summarize the thread in five bullets, then translate it into
              Arabic.
            </p>
            <div>
              <h3 className="text-[19px] font-semibold tracking-tight text-ink">
                Text
              </h3>
              <p className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-muted">
                Chat models with vision, steered by reusable Agent Skills.
              </p>
            </div>
          </article>

          <article className="kun-photo relative flex flex-col justify-between gap-6 bg-card px-6 py-6 md:col-span-12 md:flex-row md:items-center md:gap-10 md:px-8">
            <div className="max-w-md">
              <h3 className="text-[19px] font-semibold tracking-tight text-ink">
                Typed ports
              </h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
                A wire carries one kind of data and takes its colour. If two
                ports don&apos;t fit, they won&apos;t connect.
              </p>
            </div>
            <ul className="flex flex-wrap gap-2.5">
              {TYPES.map((t) => (
                <li
                  key={t.name}
                  className="flex items-center gap-2.5 rounded-full border border-line2 bg-sunken px-4 py-2 text-[14px] text-ink"
                >
                  <span
                    className="h-3 w-3 rounded-full border-2 border-card"
                    style={{ background: t.color, outline: `2px solid ${t.color}` }}
                    aria-hidden
                  />
                  {t.name}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </Reveal>
    </section>
  );
}
