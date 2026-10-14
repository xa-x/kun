"use client";

import { useEffect, useState } from "react";
import { readJson } from "@/lib/http";
import { useI18n } from "@/lib/i18n";
import { fmtCost } from "@/lib/format";
import { toast } from "@/components/Toast";
import { PageHeader } from "@/components/shell/PageHeader";
import { PlanGrid } from "@/components/pricing/PlanGrid";
import { planLabel } from "@/components/settings/ui";
import type { Plan, PlanId } from "@/lib/billing";

interface Billing {
  plan: Plan;
  plans: Plan[];
  topupAmountsUsd: number[];
  usage: {
    runs: number;
    runLimit: number;
    amountUsd: number;
    tokens: number;
    includedUsd: number;
    creditAllowanceUsd: number;
    balanceUsd: number;
  };
}

export default function BillingPage() {
  const { t, num } = useI18n();
  const [data, setData] = useState<Billing | null>(null);
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [toppingUp, setToppingUp] = useState<number | null>(null);

  const load = () => {
    fetch("/api/billing")
      .then((r) => readJson<Billing>(r))
      .then(setData)
      .catch(() => setData(null));
  };

  useEffect(load, []);

  // Back from hosted checkout: the webhook lands a moment after the redirect.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("checkout") !== "success") return;
    window.history.replaceState(null, "", window.location.pathname);
    toast(t("settings.billing.paymentReceived"), "ok");
    const timer = setTimeout(load, 3000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchPlan = async (planId: PlanId) => {
    setBusy(planId);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const j = await readJson<{ error?: string; url?: string }>(res);
      if (!res.ok) throw new Error(j.error || t("settings.billing.checkoutFailed"));
      if (j.url) {
        window.location.assign(j.url);
        return;
      }
      toast(t("settings.billing.switched", { plan: planLabel(t, planId) }), "ok");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("settings.billing.checkoutFailed"), "error");
    } finally {
      setBusy(null);
    }
  };

  const topUp = async (amountUsd: number) => {
    setToppingUp(amountUsd);
    try {
      const res = await fetch("/api/billing/topup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountUsd }),
      });
      const j = await readJson<{ error?: string; url?: string }>(res);
      if (!res.ok) throw new Error(j.error || t("settings.billing.topupFailed"));
      if (j.url) {
        window.location.assign(j.url);
        return;
      }
      toast(t("settings.billing.topupAdded", { amount: `$${amountUsd}` }), "ok");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("settings.billing.topupFailed"), "error");
    } finally {
      setToppingUp(null);
    }
  };

  const used = data ? Math.min(1, data.usage.runs / Math.max(1, data.usage.runLimit)) : 0;
  // Ledger amounts are micro-dollars; the allowance is whole dollars.
  const spent = data
    ? Math.min(1, data.usage.includedUsd / 1e6 / Math.max(0.01, data.usage.creditAllowanceUsd))
    : 0;
  // The run that crosses the line can overshoot; show the bar as full, not over.
  const includedUsed = data
    ? Math.min(data.usage.includedUsd, data.usage.creditAllowanceUsd * 1e6)
    : 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 md:px-10 md:py-12">
      <PageHeader
        title={t("settings.nav.usage")}
        description={t("settings.billing.desc")}
      />

      {data === null ? (
        <div className="space-y-4">
          <div className="kun-skeleton h-36" />
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="kun-skeleton h-[380px]" />
            ))}
          </div>
        </div>
      ) : (
        <>
          <section
            aria-label={t("settings.billing.thisMonth")}
            className="rounded-2xl border border-line bg-card/70 p-6"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-[16px] font-medium text-ink">
                {t("settings.usage.planTitle", { plan: planLabel(t, data.plan.id, data.plan.label) })}
              </h2>
              <p className="text-[13px] text-muted">{t("settings.billing.thisMonth")}</p>
            </div>

            <div className="mt-5">
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="text-muted">{t("settings.billing.runs")}</span>
                <span className="font-mono tabular-nums text-ink">
                  {num(data.usage.runs)} /{" "}
                  {num(data.usage.runLimit)}
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={data.usage.runLimit}
                aria-valuenow={data.usage.runs}
                aria-label={t("settings.billing.runsAria")}
                className="mt-2 h-2 overflow-hidden rounded-full bg-ink/10"
              >
                <div
                  className={`h-full rounded-full transition-[width] ${used > 0.9 ? "bg-warn" : "bg-ink"}`}
                  style={{ width: `${Math.max(used * 100, used > 0 ? 2 : 0)}%` }}
                />
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="text-muted">{t("settings.billing.includedCredits")}</span>
                <span className="font-mono tabular-nums text-ink">
                  {includedUsed ? fmtCost(includedUsed) : "$0.00"} / $
                  {data.usage.creditAllowanceUsd.toFixed(2)}
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={data.usage.creditAllowanceUsd}
                aria-valuenow={includedUsed / 1e6}
                aria-label={t("settings.billing.includedCreditsAria")}
                className="mt-2 h-2 overflow-hidden rounded-full bg-ink/10"
              >
                <div
                  className={`h-full rounded-full transition-[width] ${spent > 0.9 ? "bg-warn" : "bg-ink"}`}
                  style={{ width: `${Math.max(spent * 100, spent > 0 ? 2 : 0)}%` }}
                />
              </div>
              <p className="mt-2 text-[12.5px] text-faint">
                {t("settings.billing.creditsNote")}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
              <div>
                <p className="text-[13px] text-muted">{t("settings.billing.balance")}</p>
                <p className="mt-1 font-mono text-[18px] tabular-nums text-ink">
                  {data.usage.balanceUsd ? fmtCost(data.usage.balanceUsd) : "$0.00"}
                </p>
              </div>
              {data.plan.topups ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] text-muted">{t("settings.billing.addCredits")}</span>
                  {data.topupAmountsUsd.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      disabled={toppingUp !== null}
                      onClick={() => void topUp(amount)}
                      className={`kun-btn-secondary flex h-9 items-center rounded-full px-4 text-[13.5px] font-medium transition-opacity disabled:cursor-default ${
                        toppingUp !== null && toppingUp !== amount ? "opacity-50" : ""
                      }`}
                    >
                      {toppingUp === amount ? t("settings.billing.adding") : `$${amount}`}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="max-w-xs text-[12.5px] text-faint">
                  {t("settings.billing.topupsHint")}
                </p>
              )}
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-6 border-t border-line pt-5">
              <div>
                <dt className="text-[13px] text-muted">{t("settings.billing.runsLeft")}</dt>
                <dd className="mt-1 font-mono text-[18px] tabular-nums text-ink">
                  {num(Math.max(0, data.usage.runLimit - data.usage.runs))}
                </dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">{t("settings.billing.tokens")}</dt>
                <dd className="mt-1 font-mono text-[18px] tabular-nums text-ink">
                  {num(data.usage.tokens)}
                </dd>
              </div>
            </dl>
          </section>

          <h2 className="mb-4 mt-12 text-[18px] font-semibold tracking-tight text-ink">
            {t("settings.billing.changePlan")}
          </h2>
          <PlanGrid
            current={data.plan.id}
            busy={busy}
            onSelect={(id) => void switchPlan(id)}
            label={(p, isCurrent) =>
              isCurrent
                ? t("settings.billing.current")
                : busy === p.id
                  ? t("settings.billing.switching")
                  : t("settings.billing.switchTo", { plan: planLabel(t, p.id, p.label) })
            }
          />
        </>
      )}
    </div>
  );
}
