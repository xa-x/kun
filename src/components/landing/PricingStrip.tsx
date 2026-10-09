import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { PLANS } from "@/lib/billing";
import { Reveal } from "./Reveal";

function price(id: keyof typeof PLANS) {
  const p = PLANS[id];
  if (p.seatUsd) return { amount: `$${p.seatUsd}`, unit: "per seat a month" };
  if (p.monthlyUsd) return { amount: `$${p.monthlyUsd}`, unit: "a month" };
  return { amount: "$0", unit: "free forever" };
}

function summary(id: keyof typeof PLANS) {
  const p = PLANS[id];
  const lines = [`${p.monthlyRuns.toLocaleString()} runs a month`];
  lines.push(`$${p.monthlyCreditsUsd} of model credits`);
  if (p.schedules) lines.push("Schedules, webhooks and MCP");
  if (p.team) lines.push("Team workspaces");
  return lines;
}

/** Three plans as a divided strip rather than three cards. */
export function PricingStrip() {
  const ids = ["free", "pro", "team"] as const;
  return (
    <section className="mx-auto w-full max-w-[1440px] px-5 py-24 md:px-8 md:py-28">
      <Reveal>
        <h2 className="max-w-2xl text-[clamp(2rem,3.6vw,3.2rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-ink">
          Free to build. Pay to run.
        </h2>
        <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted">
          Drawing nodes costs nothing. Plans add the parts that need servers:
          durable runs, triggers and model credits.
        </p>
      </Reveal>

      <Reveal className="mt-14" delay={0.1}>
        <div className="grid divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card/60 md:grid-cols-3 md:divide-x md:divide-y-0">
          {ids.map((id) => {
            const { amount, unit } = price(id);
            return (
              <div
                key={id}
                className={`p-7 md:p-8 ${id === "pro" ? "bg-ink/[0.045]" : ""}`}
              >
                <h3 className="flex items-center gap-2.5 text-[16px] font-medium text-ink">
                  {PLANS[id].label}
                  {id === "pro" && (
                    <span className="rounded-full bg-ink px-2.5 py-0.5 text-[11.5px] font-medium text-canvas">
                      Most popular
                    </span>
                  )}
                </h3>
                <p className="mt-4 flex items-baseline gap-2">
                  <span className="text-[44px] font-semibold leading-none tracking-tight text-ink">
                    {amount}
                  </span>
                  <span className="text-[14px] text-muted">{unit}</span>
                </p>
                <ul className="mt-6 space-y-2.5 text-[14.5px] leading-snug text-muted">
                  {summary(id).map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <Link
          href="/pricing"
          className="mt-8 inline-flex items-center gap-2 text-[15px] font-medium text-ink underline-offset-4 hover:underline"
        >
          Compare plans in full
          <ArrowRight size={14} weight="bold" aria-hidden />
        </Link>
      </Reveal>
    </section>
  );
}
