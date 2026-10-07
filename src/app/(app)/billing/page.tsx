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
  usage: {
    runs: number;
    runLimit: number;
    amountUsd: number;
    tokens: number;
    creditAllowanceUsd: number;
  };
}

export default function BillingPage() {
  const [data, setData] = useState<Billing | null>(null);
  const [busy, setBusy] = useState<PlanId | null>(null);

  const load = () => {
    fetch("/api/billing")
      .then((r) => readJson<Billing>(r))
      .then(setData)
      .catch(() => setData(null));
  };

  useEffect(load, []);

  const switchPlan = async (planId: PlanId) => {
    setBusy(planId);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const j = await readJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(j.error || "Checkout failed");
      toast(`Switched to ${planId}.`, "ok");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Checkout failed", "error");
    } finally {
      setBusy(null);
    }
  };

  const used = data ? Math.min(1, data.usage.runs / Math.max(1, data.usage.runLimit)) : 0;

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

            <dl className="mt-6 grid grid-cols-2 gap-6 border-t border-line pt-5">
              <div>
                <dt className="text-[13px] text-muted">Model usage</dt>
                <dd className="mt-1 font-mono text-[18px] tabular-nums text-ink">
                  {/* Ledger amounts are micro-dollars despite the field name. */}
                  {fmtCost(data.usage.amountUsd)}
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
