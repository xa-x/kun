"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Minus } from "@phosphor-icons/react";
import { fmtMb } from "@/lib/billing";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { readJson } from "@/lib/http";
import { btnPrimary, btnSecondary, Meter, planLabel, Section } from "./ui";

interface Usage {
  plan: { id: string; label: string };
  resetsAt: string;
  meters: {
    runs: { used: number; limit: number };
    credits: { usedMicro: number; limitMicro: number; balanceMicro: number };
    projects: { used: number; limit: number | null };
    storage: { used: number; limit: number };
    members: { used: number; limit: number };
    upload: { limit: number };
  };
  features: Record<string, { on: boolean; used?: number }>;
}

const MB = 1024 * 1024;
const fmtBytes = (n: number) => fmtMb(n / MB < 10 ? Math.round((n / MB) * 10) / 10 : Math.round(n / MB));
const usd = (micro: number) => `$${(micro / 1e6).toFixed(2)}`;

const FEATURES: [string, MessageKey][] = [
  ["schedules", "settings.usage.feature.schedules"],
  ["webhooks", "settings.usage.feature.webhooks"],
  ["mcp", "settings.usage.feature.mcp"],
  ["versions", "settings.usage.feature.versions"],
  ["topups", "settings.usage.feature.topups"],
  ["team", "settings.usage.feature.team"],
];

/** The plan's limits beside what this workspace has used. */
export function UsageSettings() {
  const { t, date } = useI18n();
  const [u, setU] = useState<Usage | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    void fetch("/api/workspaces/usage")
      .then((r) => (r.ok ? readJson<Usage>(r) : Promise.reject()))
      .then((j) => live && setU(j))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  if (failed) return <p className="text-[13.5px] text-muted">{t("settings.usage.loadFailed")}</p>;
  if (!u)
    return (
      <div className="space-y-3" aria-busy>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="kun-skeleton h-14" />
        ))}
      </div>
    );

  const m = u.meters;
  const resets = date(u.resetsAt, { month: "long", day: "numeric", timeZone: "UTC" });
  return (
    <>
      <Section title={t("settings.usage.planTitle", { plan: planLabel(t, u.plan.id, u.plan.label) })} description={t("settings.usage.planDesc")}>
        <div className="flex flex-wrap gap-2">
          <Link href="/billing" className={btnPrimary}>
            {u.plan.id === "free" ? t("settings.usage.upgrade") : t("settings.usage.managePlan")}
          </Link>
          <Link href="/pricing" className={btnSecondary}>
            {t("settings.usage.compare")}
          </Link>
        </div>
      </Section>

      <Section title={t("settings.usage.thisMonth")} description={t("settings.usage.resets", { date: resets })}>
        <div className="divide-y divide-line">
          <Meter label={t("settings.usage.runs")} used={m.runs.used} limit={m.runs.limit} />
          <Meter
            label={t("settings.usage.credits")}
            used={m.credits.usedMicro / 1e6}
            limit={m.credits.limitMicro / 1e6}
            format={(n) => `$${n.toFixed(2)}`}
            hint={m.credits.balanceMicro > 0 ? t("settings.usage.creditsHint", { amount: usd(m.credits.balanceMicro) }) : undefined}
          />
        </div>
      </Section>

      <Section title={t("settings.usage.limits")}>
        <div className="divide-y divide-line">
          <Meter label={t("settings.usage.projects")} used={m.projects.used} limit={m.projects.limit} />
          <Meter label={t("settings.usage.storage")} used={m.storage.used} limit={m.storage.limit} format={fmtBytes} hint={t("settings.usage.largestUpload", { size: fmtBytes(m.upload.limit) })} />
          <Meter label={t("settings.usage.members")} used={m.members.used} limit={m.members.limit} />
        </div>
      </Section>

      <Section title={t("settings.usage.features")}>
        <ul className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
          {FEATURES.map(([k, labelKey]) => {
            const on = u.features[k]?.on;
            return (
              <li key={k} className={`flex items-center gap-2.5 text-[13.5px] ${on ? "text-ink" : "text-faint"}`}>
                {on ? <Check size={14} weight="bold" className="text-ok" aria-hidden /> : <Minus size={14} aria-hidden />}
                {t(labelKey)}
              </li>
            );
          })}
        </ul>
      </Section>
    </>
  );
}
