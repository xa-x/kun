"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PLANS, type Plan, type PlanId } from "@/lib/billing";
import { readJson } from "@/lib/http";
import { toast } from "@/components/Toast";

interface Session {
  user: { id: string; email: string } | null;
  org?: { id: string; plan: string };
}

function planFeatures(p: Plan) {
  return [
    `${p.monthlyRuns.toLocaleString()} monthly runs`,
    p.monthlyCreditsUsd ? `$${p.monthlyCreditsUsd} monthly usage credits` : "Pay-per-use model usage",
    p.schedules ? "Cron schedules + webhooks" : "Manual runs only",
    p.mcp ? "MCP server + API keys" : "No MCP / API keys",
    p.versions ? "Workbook version history" : "No version history",
    p.team ? "Team workspaces (seats)" : "Personal workspace",
  ];
}

export default function PricingPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState<PlanId | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => readJson<Session>(r))
      .then(setSession)
      .catch(() => setSession({ user: null }));
  }, []);

  const switchPlan = async (plan: PlanId) => {
    if (!session?.user) {
      router.push("/sign-in");
      return;
    }
    setBusy(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const j = await readJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(j.error || "Checkout failed");
      toast(`You're on the ${PLANS[plan].label} plan.`, "ok");
      router.push("/billing");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Checkout failed", "error");
    } finally {
      setBusy(null);
    }
  };

  const current = session?.org?.plan as PlanId | undefined;

  return (
    <main className="relative z-10 mx-auto w-full max-w-4xl flex-1 px-5 py-14">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-faint">Pricing</p>
        <h1 className="mt-1.5 text-[28px] font-semibold text-ink">Pay for reliability, not pixels</h1>
        <p className="mt-1 max-w-xl text-[13.5px] text-muted">
          Drawing nodes is free forever. Plans add durable runs, triggers, MCP access, and
          platform-managed model usage.
        </p>
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {Object.values(PLANS).map((p) => {
            const isCurrent = current === p.id;
            return (
              <li
                key={p.id}
                className={`flex flex-col rounded-2xl border p-5 ${
                  p.id === "pro"
                    ? "border-accent/60 bg-card shadow-lg shadow-black/30"
                    : "border-line bg-card/70"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <p className="text-[16px] font-medium text-ink">{p.label}</p>
                  {p.id === "pro" && (
                    <span className="rounded-full bg-accent/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-accent">
                      Popular
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-[22px] font-semibold text-ink">
                  {p.monthlyUsd
                    ? `$${p.monthlyUsd}`
                    : p.seatUsd
                      ? `$${p.seatUsd}`
                      : "$0"}
                  <span className="text-[12px] font-normal text-muted">
                    {p.seatUsd ? "/seat/mo" : "/mo"}
                  </span>
                </p>
                <ul className="mt-4 flex-1 space-y-1.5 text-[12px] text-muted">
                  {planFeatures(p).map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-accent">·</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  disabled={isCurrent || busy !== null}
                  onClick={() => switchPlan(p.id)}
                  className={`mt-5 rounded-lg px-3 py-2 text-[12.5px] font-medium transition-colors ${
                    isCurrent
                      ? "cursor-default border border-line text-faint"
                      : p.id === "pro"
                        ? "bg-accent text-white hover:bg-accent/90"
                        : "border border-line text-ink hover:bg-white/5"
                  } ${busy && busy !== p.id ? "opacity-50" : ""}`}
                >
                  {isCurrent
                    ? "Current plan"
                    : busy === p.id
                      ? "Switching…"
                      : session?.user
                        ? `Switch to ${p.label}`
                        : "Get started"}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 text-[11.5px] text-faint">
          Model usage is billed at cost through your own provider keys (BYOK), or covered by the
          monthly credits on paid plans.
        </p>
    </main>
  );
}
