"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useSettings } from "@/lib/use-settings";
import { SettingsModal } from "@/components/SettingsModal";
import { readJson } from "@/lib/http";
import { fmtCost } from "@/lib/format";
import { toast } from "@/components/Toast";
import type { Plan } from "@/lib/billing";

export default function BillingPage() {
  const settings = useSettings();
  const [data, setData] = useState<{
    plan: Plan;
    plans: Plan[];
    usage: { runs: number; runLimit: number; amountUsd: number; tokens: number; creditAllowanceUsd: number };
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    fetch("/api/billing")
      .then((r) => readJson<NonNullable<typeof data>>(r))
      .then(setData)
      .catch(() => setData(null));
  };

  useEffect(load, []);

  const switchPlan = async (planId: string) => {
    setBusy(true);
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
      setBusy(false);
    }
  };

  return (
    <div className="kun-atmosphere relative flex min-h-dvh flex-col">
      <AppHeader active="billing" onSettings={() => settings.setShowSettings(true)} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-faint">Usage</p>
        <h1 className="mt-1.5 text-[28px] font-semibold text-ink">Plan & credits</h1>
        <p className="mt-1 max-w-xl text-[13.5px] text-muted">
          You pay for reliability: durable runs, history, triggers, and platform-managed OpenRouter usage — not for drawing nodes.
        </p>
        {data && (
          <>
            <div className="mt-6 rounded-2xl border border-line bg-card/80 p-4">
              <p className="text-[14px] font-medium text-ink">Current: {data.plan.label}</p>
              <p className="mt-1 font-mono text-[11px] text-muted">
                {data.usage.runs}/{data.usage.runLimit} runs this month ·{" "}
                {fmtCost(data.usage.amountUsd)} usage · {data.usage.tokens.toLocaleString()} tokens
              </p>
            </div>
            <ul className="mt-4 grid gap-3 md:grid-cols-3">
              {data.plans.map((p) => (
                <li key={p.id} className="rounded-2xl border border-line bg-card/70 p-4">
                  <p className="text-[15px] font-medium text-ink">{p.label}</p>
                  <p className="mt-1 text-[13px] text-muted">
                    {p.monthlyUsd
                      ? `$${p.monthlyUsd}/mo`
                      : p.seatUsd
                        ? `$${p.seatUsd}/seat`
                        : "Free"}
                  </p>
                  <ul className="mt-3 space-y-1 text-[12px] text-muted">
                    <li>{p.monthlyRuns.toLocaleString()} monthly runs</li>
                    <li>{p.monthlyCreditsUsd ? `$${p.monthlyCreditsUsd} usage credits` : "Pay per use"}</li>
                    <li>{p.schedules ? "Cron + webhooks" : "Manual runs"}</li>
                      <li>{p.mcp ? "MCP + API keys" : "No MCP"}</li>
                      <li>{p.team ? "Team seats" : "Personal workspace"}</li>
                    </ul>
                    {data.plan.id !== p.id && (
                      <button
                        disabled={busy}
                        onClick={() => switchPlan(p.id)}
                        className="mt-3 rounded-lg border border-line px-3 py-1.5 text-[12px] text-ink transition-colors hover:bg-white/5 disabled:opacity-50"
                      >
                        {busy ? "Switching…" : `Switch to ${p.label}`}
                      </button>
                    )}
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
      {(settings.showSettings || settings.needsOnboard) && (
        <SettingsModal
          env={settings.env}
          onboarding={settings.needsOnboard && !settings.showSettings}
          onClose={settings.dismissOnboard}
        />
      )}
    </div>
  );
}
