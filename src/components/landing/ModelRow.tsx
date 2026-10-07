import {
  siAnthropic,
  siBytedance,
  siDeepseek,
  siGooglegemini,
  siMeta,
  siMistralai,
} from "simple-icons";

const LABS = [
  siAnthropic,
  siGooglegemini,
  siMeta,
  siMistralai,
  siBytedance,
  siDeepseek,
];

/**
 * Logo wall: logos only. Drawn in currentColor so it reads in both themes and
 * stays quiet; the page is selling the product, not the labs.
 */
export function ModelRow() {
  return (
    <section
      aria-label="Model providers"
      className="border-y border-line/60 bg-canvas/40"
    >
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-5 py-9 md:flex-row md:items-center md:gap-14 md:px-8">
        <p className="shrink-0 text-[14px] text-muted">
          Every model OpenRouter lists, including
        </p>
        <ul className="flex flex-1 flex-wrap items-center justify-between gap-x-10 gap-y-6 text-ink/60">
          {LABS.map((icon) => (
            <li key={icon.slug} className="transition-colors hover:text-ink">
              <svg
                role="img"
                viewBox="0 0 24 24"
                className="h-7 w-auto max-w-[120px] fill-current"
                aria-label={icon.title}
              >
                <title>{icon.title}</title>
                <path d={icon.path} />
              </svg>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
