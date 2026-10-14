import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n";
import { CalendarCheck, Plugs, WebhooksLogo } from "@phosphor-icons/react/dist/ssr";
import { Reveal } from "./Reveal";

const POINTS: { Icon: typeof Plugs; title: MessageKey; body: MessageKey }[] = [
  {
    Icon: CalendarCheck,
    title: "site.runs.schedules.title",
    body: "site.runs.schedules.body",
  },
  {
    Icon: WebhooksLogo,
    title: "site.runs.webhooks.title",
    body: "site.runs.webhooks.body",
  },
  {
    Icon: Plugs,
    title: "site.runs.mcp.title",
    body: "site.runs.mcp.body",
  },
];

/**
 * The code is the real surface: POST /api/runs enqueues a durable run and
 * answers 202 with its id; the events endpoint streams progress.
 */
function CodeBlock({ label }: { label: string }) {
  return (
    <div dir="ltr" className="kun-photo bg-sunken text-[13px] leading-[1.75]">
      <pre
        tabIndex={0}
        aria-label={label}
        className="overflow-x-auto px-6 py-6 font-mono text-ink/90"
      >
        <code>
          <span className="text-faint"># Start a run. It returns right away.</span>
          {"\n"}
          <span className="text-t-image">curl</span> -X POST{" "}
          <span className="text-t-video">https://kun.example/api/runs</span> \{"\n"}
          {"  "}-H <span className="text-t-video">&quot;Authorization: Bearer kun_...&quot;</span> \{"\n"}
          {"  "}-H <span className="text-t-video">&quot;Content-Type: application/json&quot;</span> \{"\n"}
          {"  "}-d <span className="text-t-video">{`'{"graphId": "k3x9f2a"}'`}</span>
          {"\n\n"}
          <span className="text-faint"># 202</span>
          {"\n"}
          {`{ "runId": "r8m2d1q", "status": "queued" }`}
          {"\n\n"}
          <span className="text-faint"># Follow it as it happens.</span>
          {"\n"}
          <span className="text-t-image">curl</span> -N{" "}
          <span className="text-t-video">https://kun.example/api/runs/r8m2d1q/events</span>
        </code>
      </pre>
    </div>
  );
}

export async function RunsSection() {
  const { t } = await getT();
  return (
    <section
      id="runs"
      className="mx-auto w-full max-w-[1440px] scroll-mt-20 px-5 py-24 md:px-8 md:py-28"
    >
      <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-20">
        <Reveal>
          <h2 className="text-[clamp(2rem,3.6vw,3.2rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-ink">
            {t("site.runs.title")}
          </h2>
          <p className="mt-5 max-w-md text-[17px] leading-relaxed text-muted">
            {t("site.runs.body")}
          </p>
          <ul className="mt-10 space-y-6">
            {POINTS.map(({ Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line2 bg-card text-ink">
                  <Icon size={19} aria-hidden />
                </span>
                <div>
                  <h3 className="text-[16px] font-medium text-ink">{t(title)}</h3>
                  <p className="mt-1 max-w-sm text-[14.5px] leading-relaxed text-muted">
                    {t(body)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.1}>
          <CodeBlock label={t("site.runs.codeAria")} />
        </Reveal>
      </div>
    </section>
  );
}
