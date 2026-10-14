"use client";

import { useState } from "react";
import Link from "next/link";
import { ago, fmtDur } from "@/lib/format";
import { readJson } from "@/lib/http";
import { toast } from "../Toast";
import { AdminPage, Badge, SearchBox, Table } from "./ui";
import { useAdminData } from "./useAdminData";

interface R {
  id: string;
  workspace: string;
  orgId: string;
  project: string;
  status: string;
  trigger: string;
  costUsd: number;
  durationMs: number | null;
  error: string | null;
  createdAt: string;
}
interface Detail {
  run: R;
  nodes: { nodeId: string; status: string; model: string | null; costUsd: number; durationMs: number | null; error: string | null }[];
}

const FILTERS = ["", "error", "running", "queued", "done", "canceled"];

export function RunsAdmin() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const { data, error, reload } = useAdminData<{ runs: R[] }>(`/api/admin/runs?status=${status}&q=${encodeURIComponent(q)}`);
  const [open, setOpen] = useState<string | null>(null);
  const detail = useAdminData<Detail>(open ? `/api/admin/runs/${open}` : "/api/admin/runs/none");

  const cancel = async (id: string) => {
    const res = await fetch(`/api/admin/runs/${id}`, { method: "POST" });
    const j = await readJson<{ error?: string }>(res).catch(() => ({} as { error?: string }));
    if (!res.ok) return toast(j.error || "Failed", "error");
    toast("Stop requested.", "ok");
    await reload();
  };

  return (
    <AdminPage
      title="Runs"
      description="The latest 100 runs across every workspace. Open one to see which node failed and what it cost."
      actions={<SearchBox value={q} onChange={setQ} placeholder="Workspace, project or run id" />}
    >
      <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Status">
        {FILTERS.map((f) => (
          <button
            key={f || "all"}
            type="button"
            aria-pressed={status === f}
            onClick={() => setStatus(f)}
            className={`h-8 rounded-full border px-3.5 text-[12.5px] capitalize transition-colors ${
              status === f ? "border-ink/50 bg-ink/10 text-ink" : "border-line text-muted hover:border-line2 hover:text-ink"
            }`}
          >
            {f || "All"}
          </button>
        ))}
      </div>
      {error && <p className="mb-3 text-[13px] text-err">{error}</p>}
      <Table head={["Run", "Workspace / project", "Trigger", "Cost", "Time", "When", ""]} empty={data && data.runs.length === 0 ? "No runs match." : undefined}>
        {(data?.runs ?? []).map((r) => (
          <tr key={r.id} className="align-top">
            <td className="px-4 py-3">
              <Badge tone={r.status === "done" ? "ok" : r.status === "error" ? "warn" : "plain"}>{r.status}</Badge>
              <p className="mt-1 font-mono text-[11px] text-faint">{r.id}</p>
            </td>
            <td className="px-4 py-3">
              <Link href={`/admin/workspaces/${r.orgId}`} className="text-ink underline decoration-line2 underline-offset-2 hover:decoration-ink">
                {r.workspace}
              </Link>
              <p className="text-[12px] text-faint">{r.project}</p>
              {r.error && <p className="mt-1 max-w-sm truncate text-[12px] text-err" title={r.error}>{r.error}</p>}
            </td>
            <td className="px-4 py-3 capitalize text-muted">{r.trigger}</td>
            <td className="px-4 py-3 font-mono tabular-nums">${r.costUsd.toFixed(4)}</td>
            <td className="px-4 py-3 font-mono tabular-nums text-muted">{fmtDur(r.durationMs)}</td>
            <td className="px-4 py-3 text-muted">{ago(r.createdAt)}</td>
            <td className="px-4 py-3 text-end">
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="kun-btn-secondary h-8 rounded-full px-3.5 text-[12.5px] font-medium">
                  {open === r.id ? "Hide" : "Details"}
                </button>
                {(r.status === "running" || r.status === "queued") && (
                  <button type="button" onClick={() => void cancel(r.id)} className="h-8 rounded-full px-3.5 text-[12.5px] text-muted hover:bg-err/10 hover:text-err">
                    Stop
                  </button>
                )}
              </div>
              {open === r.id && (
                <div className="mt-3 rounded-xl border border-line bg-sunken p-3 text-start">
                  {!detail.data ? (
                    <p className="text-[12px] text-muted">Loading…</p>
                  ) : (
                    <ul className="space-y-2">
                      {detail.data.nodes.map((n) => (
                        <li key={n.nodeId} className="text-[12px]">
                          <span className="font-mono text-faint">{n.nodeId}</span> <Badge tone={n.status === "done" ? "ok" : n.status === "error" ? "warn" : "plain"}>{n.status}</Badge>{" "}
                          <span className="text-muted">
                            {n.model ?? ""} · ${n.costUsd.toFixed(4)} · {fmtDur(n.durationMs)}
                          </span>
                          {n.error && <p className="mt-0.5 text-err">{n.error}</p>}
                        </li>
                      ))}
                      {detail.data.nodes.length === 0 && <li className="text-[12px] text-muted">No node records.</li>}
                    </ul>
                  )}
                </div>
              )}
            </td>
          </tr>
        ))}
      </Table>
      {!data && !error && <div className="kun-skeleton mt-3 h-24" aria-busy />}
    </AdminPage>
  );
}
