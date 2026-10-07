"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PLANS, type PlanId } from "@/lib/billing";
import { readJson } from "@/lib/http";
import { signInHref } from "@/lib/routes";
import { toast } from "@/components/Toast";
import { PlanGrid } from "@/components/pricing/PlanGrid";

interface Session {
  user: { id: string; email: string } | null;
  org?: { id: string; plan: string };
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
      router.push(signInHref("/pricing"));
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

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-16 md:px-8 md:py-24">
      <h1 className="max-w-2xl text-[40px] font-semibold leading-[1.05] tracking-tight text-ink md:text-[52px]">
        Pay for reliability, not for drawing boxes.
      </h1>
      <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-muted">
        The canvas is free. Plans add durable runs, schedules, webhooks, MCP
        access and managed model usage.
      </p>

      <div className="mt-12">
        <PlanGrid
          current={session?.org?.plan as PlanId | undefined}
          busy={busy}
          onSelect={(id) => void switchPlan(id)}
          label={(p, isCurrent) =>
            isCurrent
              ? "Current plan"
              : busy === p.id
                ? "Switching…"
                : session?.user
                  ? `Switch to ${p.label}`
                  : p.id === "free"
                    ? "Start free"
                    : `Choose ${p.label}`
          }
        />
      </div>

      <p className="mt-8 max-w-2xl text-[13.5px] leading-relaxed text-faint">
        Model usage is billed at cost, or covered by the monthly credits on paid
        plans.
      </p>
    </div>
  );
}
