"use client";

import Link from "next/link";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { AdminPage, fmtMB, Stat, usd } from "./ui";
import { useAdminData } from "./useAdminData";

interface Overview {
  totals: { users: number; workspaces: number; projects: number; posts: number; storageBytes: number };
  plans: Record<string, number>;
  last24h: { runs: number; failedRuns: number };
  spend30dUsd: number;
  queue: { active: number; failed24h: number };
  series: { day: string; runs: number; failed: number }[];
  health: { id: string; label: string; ok: boolean; fix: string }[];
  signupOpen: boolean;
}

export function AdminOverview() {
  const { data: d, error } = useAdminData<Overview>("/api/admin/overview");
  if (error) return <AdminPage title="Overview"><p className="text-[13.5px] text-err">{error}</p></AdminPage>;
  if (!d)
    return (
      <AdminPage title="Overview">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-busy>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="kun-skeleton h-24" />
          ))}
        </div>
      </AdminPage>
    );
  const peak = Math.max(1, ...d.series.map((s) => s.runs));
  const failRate = d.last24h.runs ? d.last24h.failedRuns / d.last24h.runs : 0;
  const broken = d.health.filter((h) => !h.ok);

  return (
    <AdminPage title="Overview" description="How the platform is doing right now.">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Users" value={String(d.totals.users)} />
        <Stat label="Workspaces" value={String(d.totals.workspaces)} hint={`${d.plans.pro ?? 0} Pro · ${d.plans.team ?? 0} Team · ${d.plans.free ?? 0} Free`} />
        <Stat label="Projects" value={String(d.totals.projects)} hint={`${d.totals.posts} published`} />
        <Stat label="Storage used" value={fmtMB(d.totals.storageBytes)} />
        <Stat label="Runs, last 24h" value={String(d.last24h.runs)} />
        <Stat
          label="Failed runs, 24h"
          value={String(d.last24h.failedRuns)}
          hint={d.last24h.runs ? `${Math.round(failRate * 100)}% of runs` : undefined}
          tone={failRate > 0.2 ? "err" : failRate > 0.05 ? "warn" : undefined}
        />
        <Stat label="Model spend, 30d" value={usd(d.spend30dUsd)} hint="What users were charged" />
        <Stat
          label="Job queue"
          value={String(d.queue.active)}
          hint={d.queue.failed24h ? `${d.queue.failed24h} failed in 24h` : "Nothing failing"}
          tone={d.queue.failed24h ? "warn" : undefined}
        />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section aria-label="Runs per day">
          <h2 className="mb-3 text-[12px] font-medium uppercase tracking-[0.12em] text-faint">Runs, last 14 days</h2>
          {d.series.length === 0 ? (
            <p className="rounded-2xl border border-line px-4 py-10 text-center text-[13px] text-muted">No runs yet.</p>
          ) : (
            <ul className="flex h-40 items-end gap-1.5 rounded-2xl border border-line bg-card/40 p-4">
              {d.series.map((s) => (
                <li key={s.day} className="group relative flex h-full flex-1 flex-col justify-end" title={`${s.day}: ${s.runs} runs, ${s.failed} failed`}>
                  <span className="block w-full rounded-t bg-ink/70" style={{ height: `${(s.runs / peak) * 100}%`, minHeight: 3 }}>
                    {s.failed > 0 && <span className="block w-full rounded-t bg-err" style={{ height: `${(s.failed / s.runs) * 100}%` }} />}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="System health">
          <h2 className="mb-3 text-[12px] font-medium uppercase tracking-[0.12em] text-faint">
            System {broken.length ? `· ${broken.length} to fix` : "· all good"}
          </h2>
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {d.health.map((h) => (
              <li key={h.id} className="flex items-start gap-3 px-4 py-3">
                {h.ok ? (
                  <CheckCircle size={17} weight="fill" className="mt-0.5 shrink-0 text-ok" aria-hidden />
                ) : (
                  <WarningCircle size={17} weight="fill" className="mt-0.5 shrink-0 text-warn" aria-hidden />
                )}
                <div className="min-w-0">
                  <p className="text-[13px] text-ink">{h.label}</p>
                  {!h.ok && <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{h.fix}</p>}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12.5px] text-faint">
            Sign-up is {d.signupOpen ? "open to everyone" : "invite-only"}.{" "}
            <Link href="/admin/models" className="text-muted underline underline-offset-2 hover:text-ink">
              Check model spend
            </Link>
          </p>
        </section>
      </div>
    </AdminPage>
  );
}
