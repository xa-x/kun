"use client";

import { ago } from "@/lib/format";
import { AdminPage, Stat, Table, usd } from "./ui";
import { useAdminData } from "./useAdminData";

interface B {
  window: string;
  creditsSoldUsd: number;
  creditsGrantedUsd: number;
  chargedUsd: number;
  chargedFromBalanceUsd: number;
  providerCostUsd: number;
  plans: Record<string, number>;
  byModel: { model: string; calls: number; costUsd: number }[];
  recentTopups: { id: string; workspace: string; usd: number; source: string; createdAt: string }[];
}

export function BillingAdmin() {
  const { data: d, error } = useAdminData<B>("/api/admin/billing");
  const margin = d && d.providerCostUsd > 0 ? (d.chargedUsd - d.providerCostUsd) / d.chargedUsd : null;
  return (
    <AdminPage title="Billing and margin" description={`Money in and out, ${d?.window ?? "last 30 days"}. Credits sold are paid top-ups; granted credit was given by an admin.`}>
      {error && <p className="mb-3 text-[13px] text-err">{error}</p>}
      {!d ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-busy>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="kun-skeleton h-24" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Credits sold" value={usd(d.creditsSoldUsd)} hint={`${d.plans.pro ?? 0} Pro · ${d.plans.team ?? 0} Team workspaces`} />
            <Stat label="Credit granted" value={usd(d.creditsGrantedUsd)} hint="Given by admins" />
            <Stat label="Charged to users" value={usd(d.chargedUsd)} hint={`${usd(d.chargedFromBalanceUsd)} from prepaid balance`} />
            <Stat
              label="Model cost to us"
              value={usd(d.providerCostUsd)}
              hint={margin === null ? "No spend yet" : `${Math.round(margin * 100)}% margin on charges`}
              tone={margin !== null && margin < 0 ? "err" : undefined}
            />
          </div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-faint">
            Model cost is what the node records say each call cost (image generation is recorded as 0 by the provider, so this is a lower bound — compare with the OpenRouter total on the Models page). Subscription revenue lives in Polar, not here.
          </p>

          <h2 className="mb-3 mt-8 text-[12px] font-medium uppercase tracking-[0.12em] text-faint">Cost by model</h2>
          <Table head={["Model", "Calls", "Recorded cost"]} empty={d.byModel.length === 0 ? "No calls yet." : undefined}>
            {d.byModel.map((m) => (
              <tr key={m.model}>
                <td className="px-4 py-3 font-mono text-[12px] text-ink">{m.model}</td>
                <td className="px-4 py-3 font-mono tabular-nums">{m.calls}</td>
                <td className="px-4 py-3 font-mono tabular-nums">{usd(m.costUsd)}</td>
              </tr>
            ))}
          </Table>

          <h2 className="mb-3 mt-8 text-[12px] font-medium uppercase tracking-[0.12em] text-faint">Recent credit additions</h2>
          <Table head={["Workspace", "Amount", "Source", "When"]} empty={d.recentTopups.length === 0 ? "None yet." : undefined}>
            {d.recentTopups.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3 text-ink">{t.workspace}</td>
                <td className="px-4 py-3 font-mono tabular-nums">{usd(t.usd)}</td>
                <td className="px-4 py-3 capitalize text-muted">{t.source}</td>
                <td className="px-4 py-3 text-muted">{ago(t.createdAt)}</td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </AdminPage>
  );
}
