import { CalendarCheck, Plugs, WebhooksLogo } from "@phosphor-icons/react/dist/ssr";
import { Reveal } from "./Reveal";

const POINTS = [
  {
    Icon: CalendarCheck,
    title: "Schedules",
    body: "Run a workbook on a cron, with every result and cost kept in history.",
  },
  {
    Icon: WebhooksLogo,
    title: "Webhooks",
    body: "Trigger it from anything that can send a signed request.",
  },
  {
    Icon: Plugs,
    title: "MCP and API keys",
    body: "Let an agent or a script run your workbook as a tool.",
  },
];

/**
 * The code is the real surface: POST /api/runs enqueues a durable run and
 * answers 202 with its id; the events endpoint streams progress.
 */
function CodeBlock() {
  return (
    <div className="kun-photo bg-sunken text-[13px] leading-[1.75]">
      <pre
        tabIndex={0}
        aria-label="Example: start a run and follow its events with curl"
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

export function RunsSection() {
  return (
    <section
      id="runs"
      className="mx-auto w-full max-w-[1440px] scroll-mt-20 px-5 py-24 md:px-8 md:py-28"
    >
      <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-20">
        <Reveal>
          <h2 className="text-[clamp(2rem,3.6vw,3.2rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-ink">
            Close the tab. It keeps running.
          </h2>
          <p className="mt-5 max-w-md text-[17px] leading-relaxed text-muted">
            Runs live on the server, not in your browser. Start one by hand, by
            schedule or over the API, and check on it later.
          </p>
          <ul className="mt-10 space-y-6">
            {POINTS.map(({ Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line2 bg-card text-ink">
                  <Icon size={19} aria-hidden />
                </span>
                <div>
                  <h3 className="text-[16px] font-medium text-ink">{title}</h3>
                  <p className="mt-1 max-w-sm text-[14.5px] leading-relaxed text-muted">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.1}>
          <CodeBlock />
        </Reveal>
      </div>
    </section>
  );
}
