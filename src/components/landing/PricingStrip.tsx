import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { PLANS } from "@/lib/billing";
import { Reveal } from "./Reveal";

type T = Awaited<ReturnType<typeof getT>>;

function price(id: keyof typeof PLANS, { t }: T) {
  const p = PLANS[id];
  if (p.seatUsd) return { amount: `$${p.seatUsd}`, unit: t("site.pricing.unit.seat") };
  if (p.monthlyUsd) return { amount: `$${p.monthlyUsd}`, unit: t("site.pricing.unit.month") };
  return { amount: "$0", unit: t("site.pricing.unit.free") };
}

function summary(id: keyof typeof PLANS, { t, tn }: T) {
  const p = PLANS[id];
  const lines = p.seatUsd
    ? [
        t("site.pricing.runsSeat", { n: p.monthlyRuns.toLocaleString() }),
        t("site.pricing.creditsSeat", { amount: p.monthlyCreditsUsd }),
      ]
    : [tn("site.pricing.runs", p.monthlyRuns), t("site.pricing.credits", { amount: p.monthlyCreditsUsd })];
  if (p.minSeats) lines.push(t("site.pricing.minSeats", { n: p.minSeats }));
  if (p.topups) lines.push(t("site.pricing.topups"));
  if (p.schedules) lines.push(t("site.pricing.triggers"));
  if (p.team) lines.push(t("site.pricing.team"));
  return lines;
}

const PLAN_LABEL = {
  free: "site.pricing.plan.free",
  pro: "site.pricing.plan.pro",
  team: "site.pricing.plan.team",
} as const;

/** Three plans as a divided strip rather than three cards. */
export async function PricingStrip() {
  const i18n = await getT();
  const { t } = i18n;
  const ids = ["free", "pro", "team"] as const;
  return (
    <section className="mx-auto w-full max-w-[1440px] px-5 py-24 md:px-8 md:py-28">
      <Reveal>
        <h2 className="max-w-2xl text-[clamp(2rem,3.6vw,3.2rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-ink">
          {t("site.pricing.title")}
        </h2>
        <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted">
          {t("site.pricing.body")}
        </p>
      </Reveal>

      <Reveal className="mt-14" delay={0.1}>
        <div className="grid divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card/60 md:grid-cols-3 md:divide-x md:divide-y-0">
          {ids.map((id) => {
            const { amount, unit } = price(id, i18n);
            return (
              <div
                key={id}
                className={`p-7 md:p-8 ${id === "pro" ? "bg-ink/[0.045]" : ""}`}
              >
                <h3 className="flex items-center gap-2.5 text-[16px] font-medium text-ink">
                  {t(PLAN_LABEL[id])}
                  {id === "pro" && (
                    <span className="rounded-full bg-ink px-2.5 py-0.5 text-[11.5px] font-medium text-canvas">
                      {t("site.pricing.popular")}
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
                  {summary(id, i18n).map((l) => (
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
          {t("site.pricing.compare")}
          <ArrowRight size={14} weight="bold" className="rtl-flip" aria-hidden />
        </Link>
      </Reveal>
    </section>
  );
}
