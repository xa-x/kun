"use client";

import { useState } from "react";
import Link from "next/link";
import { ago } from "@/lib/format";
import { readJson } from "@/lib/http";
import { toast } from "../Toast";
import { AdminPage, Badge, fmtMB, SearchBox, Table, usd } from "./ui";
import { useAdminData } from "./useAdminData";

interface W {
  id: string;
  name: string;
  plan: string;
  owner: string | null;
  members: number;
  projects: number;
  storageBytes: number;
  spendMonthUsd: number;
  balanceUsd: number;
  billed: boolean;
  suspended: boolean;
  createdAt: string;
}

export function WorkspacesAdmin() {
  const [q, setQ] = useState("");
  const { data, error, reload } = useAdminData<{ workspaces: W[] }>(`/api/admin/workspaces?q=${encodeURIComponent(q)}`);
  const [grant, setGrant] = useState<{ w: W; amount: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const patch = async (id: string, body: object, done: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/workspaces/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await readJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(j.error || "Failed");
      toast(done, "ok");
      setGrant(null);
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPage
      title="Workspaces"
      description="Plans, usage and credit for every workspace. Changes here are written to the audit log."
      actions={<SearchBox value={q} onChange={setQ} placeholder="Search workspace name" />}
    >
      {error && <p className="mb-3 text-[13px] text-err">{error}</p>}
      <Table head={["Workspace", "Plan", "Members", "Projects", "Storage", "Spend (month)", "Balance", ""]} empty={data && data.workspaces.length === 0 ? "No workspaces match." : undefined}>
        {(data?.workspaces ?? []).map((w) => (
          <tr key={w.id} className="align-top">
            <td className="px-4 py-3">
              <Link href={`/admin/workspaces/${w.id}`} className="text-ink underline decoration-line2 underline-offset-2 hover:decoration-ink">
                {w.name}
              </Link>{" "}
              {w.suspended && <Badge tone="warn">suspended</Badge>}
              <p className="text-[12px] text-faint">
                {w.owner ?? "no owner"} · {ago(w.createdAt)}
              </p>
            </td>
            <td className="px-4 py-3">
              <label className="sr-only" htmlFor={`plan-${w.id}`}>
                Plan for {w.name}
              </label>
              <select
                id={`plan-${w.id}`}
                value={w.plan}
                disabled={busy || w.billed}
                title={w.billed ? "Has a live subscription: change it in Polar" : undefined}
                onChange={(e) => void patch(w.id, { plan: e.target.value }, `${w.name} is now on ${e.target.value}.`)}
                className="kun-input !h-8 !w-auto !px-2 !text-[12.5px] capitalize disabled:opacity-60"
              >
                {["free", "pro", "team"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              {w.billed && <Badge tone="ok">billed</Badge>}
            </td>
            <td className="px-4 py-3 font-mono tabular-nums">{w.members}</td>
            <td className="px-4 py-3 font-mono tabular-nums">{w.projects}</td>
            <td className="px-4 py-3 font-mono tabular-nums">{fmtMB(w.storageBytes)}</td>
            <td className="px-4 py-3 font-mono tabular-nums">{usd(w.spendMonthUsd)}</td>
            <td className="px-4 py-3 font-mono tabular-nums">{usd(w.balanceUsd)}</td>
            <td className="px-4 py-3 text-end">
              <button type="button" onClick={() => setGrant({ w, amount: "10" })} className="kun-btn-secondary h-8 rounded-full px-3.5 text-[12.5px] font-medium">
                Grant credit
              </button>
            </td>
          </tr>
        ))}
      </Table>
      {!data && !error && <div className="kun-skeleton mt-3 h-24" aria-busy />}

      {grant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
          <button type="button" aria-label="Close" onClick={() => setGrant(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <form
            role="dialog"
            aria-label="Grant credit"
            dir="ltr"
            className="kun-pop relative w-full max-w-sm rounded-2xl border border-line2 bg-card p-6"
            onSubmit={(e) => {
              e.preventDefault();
              void patch(grant.w.id, { grantUsd: Number(grant.amount) }, `Granted $${grant.amount} to ${grant.w.name}.`);
            }}
          >
            <h2 className="text-[16px] font-medium text-ink">Grant credit to {grant.w.name}</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">Adds to the prepaid balance. It is recorded in the audit log under your email.</p>
            <label htmlFor="grant" className="mb-1.5 mt-4 block text-[13px] font-medium text-ink">
              Amount (USD, up to 500)
            </label>
            <input
              id="grant"
              autoFocus
              type="number"
              min="1"
              max="500"
              step="1"
              value={grant.amount}
              onChange={(e) => setGrant({ ...grant, amount: e.target.value })}
              className="kun-input font-mono"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setGrant(null)} className="h-10 rounded-full px-5 text-[13px] text-muted hover:text-ink">
                Cancel
              </button>
              <button type="submit" disabled={busy || !(Number(grant.amount) > 0)} className="kun-btn-primary h-10 rounded-full px-5 text-[13px] font-medium disabled:opacity-50">
                {busy ? "Granting…" : "Grant"}
              </button>
            </div>
          </form>
        </div>
      )}
    </AdminPage>
  );
}
