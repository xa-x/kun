import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Reveal } from "./Reveal";

const FEATURE = {
  src: "/landing/tpl-product.jpg",
  alt: "A matte black speaker on a concrete plinth with one warm edge light",
  title: "Product shoot to launch film",
  body: "Start from one reference photo. Generate styled stills, pick the best, and animate it into a five second spot.",
  steps: ["Image", "AI Image", "AI Video"],
};

const ROWS = [
  {
    src: "/landing/tpl-storyboard.jpg",
    alt: "A pencil storyboard of six frames with one washed in teal",
    title: "Script to storyboard",
    body: "Break a script into frames, then narrate them.",
  },
  {
    src: "/landing/tpl-moodboard.jpg",
    alt: "A mood board of tile, glass, fern and wool on linen",
    title: "Moodboard from a brief",
    body: "Three sentences in, a palette and imagery out.",
  },
  {
    src: "/landing/tpl-film.jpg",
    alt: "A desert highway at dusk with a single car's lights",
    title: "Title sequence",
    body: "A prompt becomes a film still, then a moving shot.",
  },
];

export function Examples() {
  return (
    <section className="mx-auto w-full max-w-[1440px] px-5 py-24 md:px-8 md:py-28">
      <Reveal>
        <h2 className="max-w-2xl text-[clamp(2rem,3.6vw,3.2rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-ink">
          What you can build in an afternoon.
        </h2>
        <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted">
          Clone a published workbook, swap the models, and make it yours.
        </p>
      </Reveal>

      <Reveal className="mt-14" delay={0.1}>
        <div className="grid gap-4 lg:grid-cols-12">
          <Link
            href="/templates"
            className="group relative overflow-hidden rounded-2xl border border-line bg-card lg:col-span-7"
          >
            <div className="kun-photo !rounded-none !border-0 aspect-[4/3]">
              <Image
                src={FEATURE.src}
                alt={FEATURE.alt}
                fill
                sizes="(min-width: 1024px) 55vw, 100vw"
                className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              />
            </div>
            <div className="p-6 md:p-7">
              <h3 className="text-[22px] font-semibold tracking-tight text-ink">
                {FEATURE.title}
              </h3>
              <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted">
                {FEATURE.body}
              </p>
              <ul className="mt-5 flex flex-wrap items-center gap-2">
                {FEATURE.steps.map((s, i) => (
                  <li key={s} className="flex items-center gap-2">
                    <span className="rounded-full border border-line2 px-3 py-1 text-[12.5px] text-muted">
                      {s}
                    </span>
                    {i < FEATURE.steps.length - 1 && (
                      <ArrowRight size={12} weight="bold" className="text-faint" aria-hidden />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </Link>

          <ul className="grid gap-4 lg:col-span-5 lg:grid-rows-3">
            {ROWS.map((r) => (
              <li key={r.title}>
                <Link
                  href="/templates"
                  className="group flex h-full items-stretch gap-5 overflow-hidden rounded-2xl border border-line bg-card p-3 transition-colors hover:border-line2"
                >
                  <div className="kun-photo relative aspect-[4/3] w-[42%] shrink-0 !rounded-xl">
                    <Image
                      src={r.src}
                      alt={r.alt}
                      fill
                      sizes="(min-width: 1024px) 20vw, 40vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                    />
                  </div>
                  <div className="flex min-w-0 flex-col justify-center py-1 pr-3">
                    <h3 className="text-[17px] font-semibold tracking-tight text-ink">
                      {r.title}
                    </h3>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
                      {r.body}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <Link
          href="/templates"
          className="mt-8 inline-flex items-center gap-2 text-[15px] font-medium text-ink underline-offset-4 hover:underline"
        >
          Browse all templates
          <ArrowRight size={14} weight="bold" aria-hidden />
        </Link>
      </Reveal>
    </section>
  );
}
