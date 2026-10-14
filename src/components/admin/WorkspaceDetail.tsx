"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react";
import { ago } from "@/lib/format";
import { readJson } from "@/lib/http";
import { toast } from "../Toast";
import { AdminPage, Badge, fmtMB, Stat, Table, usd } from "./ui";
import { useAdminData } from "./useAdminData";

interface D {
  workspace: { id: string; name: string; plan: string; billed: boolean; balanceUsd: number; suspended: boolean; createdAt: string };
  usage: { projects: number; storageBytes: number; members: number; schedules: number; webhooks: number; keys: number };
  members: { id: string; name: string; email: string; role: string; joinedAt: string }[];
  recentRuns: { id: string; status: string; trigger: string; costUsd: number; error: string | null; createdAt: string }[];
  projects: { id: string; title: string; updatedAt: string }[];
}

export function WorkspaceDetail({ id }: { id: string }) {
  const { data: d, error, reload } = useAdminData<D>(`/api/admin/workspaces/${id}`);
  const [reason, setReason] = useState("");

  const patch = async (body: object, done: string) => {
    const res = await fetch(`/api/admin/workspaces/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await readJson<{ error?: string }>(res).catch(() => ({} as { error?: string }));
    if (!res.ok) return toast(j.error || "Failed", "error");
    toast(done, "ok");
    setReason("");
    await reload();
  };

  return (
    <AdminPage title={d?.workspace.name ?? "Workspace"} description={d ? `Created ${ago(d.workspace.createdAt)} · ${d.workspace.id}` : undefined}>
      <Link href="/admin/workspaces" className="-mt-4 mb-6 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <ArrowLeft size={13} weight="bold" aria-hidden />
        All workspaces
      </Link>
      {error && <p className="mb-3 text-[13px] text-err">{error}</p>}
      {!d ? (
        <div className="kun-skeleton h-48" aria-busy />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Plan" value={d.workspace.plan} hint={d.workspace.billed ? "Billed through Polar" : "Not billed"} />
            <Stat label="Credit balance" value={usd(d.workspace.balanceUsd)} />
            <Stat label="Projects" value={String(d.usage.projects)} />
            <Stat label="Storage" value={fmtMB(d.usage.storageBytes)} />
          </div>

          <section className={`mt-8 rounded-2xl border p-5 ${d.workspace.suspended ? "border-warn/50 bg-warn/5" : "border-line bg-card/60"}`}>
            <h2 className="text-[15px] font-medium text-ink">{d.workspace.suspended ? "This workspace is suspended" : "Suspend workspace"}</h2>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-muted">
              {d.workspace.suspended
                ? "It can't start runs (including schedules and webhooks). Its data is untouched and its members can still sign in."
                : "Stops this workspace from starting any runs, for abuse or non-payment. Reversible, and nothing is deleted."}
            </p>
            {!d.workspace.suspended && <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (kept in the audit log)" maxLength={200} className="kun-input mt-3 max-w-md" />}
            <button
              type="button"
              onClick={() => void patch({ suspended: !d.workspace.suspended, reason }, d.workspace.suspended ? "Workspace restored." : "Workspace suspended.")}
              className={`mt-3 h-10 rounded-full px-5 text-[13px] font-medium ${d.workspace.suspended ? "kun-btn-primary" : "bg-err/90 text-white"}`}
            >
              {d.workspace.suspended ? "Restore workspace" : "Suspend"}
            </button>
          </section>

          <h2 className="mb-3 mt-8 text-[12px] font-medium uppercase tracking-[0.12em] text-faint">Members</h2>
          <Table head={["Name", "Email", "Role", "Joined"]}>
            {d.members.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-3 text-ink">{m.name}</td>
                <td className="px-4 py-3 text-muted">{m.email}</td>
                <td className="px-4 py-3">
                  <Badge>{m.role}</Badge>
                </td>
                <td className="px-4 py-3 text-muted">{ago(m.joinedAt)}</td>
              </tr>
            ))}
          </Table>

          <h2 className="mb-3 mt-8 text-[12px] font-medium uppercase tracking-[0.12em] text-faint">Recent runs</h2>
          <Table head={["Run", "Trigger", "Cost", "When"]} empty={d.recentRuns.length === 0 ? "No runs yet." : undefined}>
            {d.recentRuns.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3">
                  <Badge tone={r.status === "done" ? "ok" : r.status === "error" ? "warn" : "plain"}>{r.status}</Badge>
                  {r.error && <p className="mt-1 max-w-md truncate text-[12px] text-err">{r.error}</p>}
                </td>
                <td className="px-4 py-3 capitalize text-muted">{r.trigger}</td>
                <td className="px-4 py-3 font-mono tabular-nums">${r.costUsd.toFixed(4)}</td>
                <td className="px-4 py-3 text-muted">{ago(r.createdAt)}</td>
              </tr>
            ))}
          </Table>

          <h2 className="mb-3 mt-8 text-[12px] font-medium uppercase tracking-[0.12em] text-faint">Latest projects</h2>
          <Table head={["Project", "Updated"]} empty={d.projects.length === 0 ? "No projects." : undefined}>
            {d.projects.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 text-ink">{p.title || "Untitled"}</td>
                <td className="px-4 py-3 text-muted">{ago(p.updatedAt)}</td>
              </tr>
            ))}
          </Table>
          <p className="mt-6 text-[12.5px] text-faint">
            {d.usage.schedules} schedules · {d.usage.webhooks} webhooks · {d.usage.keys} API keys
          </p>
        </>
      )}
    </AdminPage>
  );
}
