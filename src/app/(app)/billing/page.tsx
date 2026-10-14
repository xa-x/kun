"use client";

import { useEffect, useState } from "react";
import { readJson } from "@/lib/http";
import { fmtCost } from "@/lib/format";
import { toast } from "@/components/Toast";
import { PageHeader } from "@/components/shell/PageHeader";
import { PlanGrid } from "@/components/pricing/PlanGrid";
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
    toast("Payment received. It can take a moment to show here.", "ok");
    const t = setTimeout(load, 3000);
    return () => clearTimeout(t);
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
      if (!res.ok) throw new Error(j.error || "Checkout failed");
      if (j.url) {
        window.location.assign(j.url);
        return;
      }
      toast(`Switched to ${planId}.`, "ok");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Checkout failed", "error");
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
      if (!res.ok) throw new Error(j.error || "Top-up failed");
      if (j.url) {
        window.location.assign(j.url);
        return;
      }
      toast(`Added $${amountUsd} of credits.`, "ok");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Top-up failed", "error");
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
        title="Plan and usage"
        description="You pay for reliability: durable runs, history, triggers and managed model usage. Drawing nodes is free."
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
            aria-label="This month"
            className="rounded-2xl border border-line bg-card/70 p-6"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-[16px] font-medium text-ink">
                {data.plan.label} plan
              </h2>
              <p className="text-[13px] text-muted">This month</p>
            </div>

            <div className="mt-5">
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="text-muted">Runs</span>
                <span className="font-mono tabular-nums text-ink">
                  {data.usage.runs.toLocaleString()} /{" "}
                  {data.usage.runLimit.toLocaleString()}
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={data.usage.runLimit}
                aria-valuenow={data.usage.runs}
                aria-label="Runs used this month"
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
                <span className="text-muted">Included model credits</span>
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
                aria-label="Included model credits used this month"
                className="mt-2 h-2 overflow-hidden rounded-full bg-ink/10"
              >
                <div
                  className={`h-full rounded-full transition-[width] ${spent > 0.9 ? "bg-warn" : "bg-ink"}`}
                  style={{ width: `${Math.max(spent * 100, spent > 0 ? 2 : 0)}%` }}
                />
              </div>
              <p className="mt-2 text-[12.5px] text-faint">
                Included credits reset each month and are spent first. After
                that, runs draw on your credit balance and pause when it is
                empty.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
              <div>
                <p className="text-[13px] text-muted">Credit balance</p>
                <p className="mt-1 font-mono text-[18px] tabular-nums text-ink">
                  {data.usage.balanceUsd ? fmtCost(data.usage.balanceUsd) : "$0.00"}
                </p>
              </div>
              {data.plan.topups ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] text-muted">Add credits</span>
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
                      {toppingUp === amount ? "Adding…" : `$${amount}`}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="max-w-xs text-[12.5px] text-faint">
                  Pro and Team can add prepaid credits that never expire.
                </p>
              )}
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-6 border-t border-line pt-5">
              <div>
                <dt className="text-[13px] text-muted">Runs left</dt>
                <dd className="mt-1 font-mono text-[18px] tabular-nums text-ink">
                  {Math.max(0, data.usage.runLimit - data.usage.runs).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-[13px] text-muted">Tokens</dt>
                <dd className="mt-1 font-mono text-[18px] tabular-nums text-ink">
                  {data.usage.tokens.toLocaleString()}
                </dd>
              </div>
            </dl>
          </section>

          <h2 className="mb-4 mt-12 text-[18px] font-semibold tracking-tight text-ink">
            Change plan
          </h2>
          <PlanGrid
            current={data.plan.id}
            busy={busy}
            onSelect={(id) => void switchPlan(id)}
            label={(p, isCurrent) =>
              isCurrent
                ? "Current plan"
                : busy === p.id
                  ? "Switching…"
                  : `Switch to ${p.label}`
            }
          />
        </>
      )}
    </div>
  );
}
