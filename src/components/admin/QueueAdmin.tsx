"use client";

import { ago } from "@/lib/format";
import { readJson } from "@/lib/http";
import { toast } from "../Toast";
import { AdminPage, Badge, Stat, Table } from "./ui";
import { useAdminData } from "./useAdminData";

interface J {
  id: string;
  kind: string;
  status: string;
  workspace: string;
  attempts: number;
  error: string | null;
  runAt: string;
  createdAt: string;
}

export function QueueAdmin() {
  const { data, error, reload } = useAdminData<{ counts: Record<string, number>; jobs: J[] }>("/api/admin/jobs");
  const act = async (id: string, action: "retry" | "drop") => {
    const res = await fetch(`/api/admin/jobs/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    const j = await readJson<{ error?: string }>(res).catch(() => ({} as { error?: string }));
    if (!res.ok) return toast(j.error || "Failed", "error");
    toast(action === "retry" ? "Back in the queue." : "Job dropped.", "ok");
    await reload();
  };
  const c = data?.counts ?? {};
  return (
    <AdminPage title="Queue" description="Background jobs: runs, schedules and webhooks waiting to execute. Failed jobs can be retried here.">
      {error && <p className="mb-3 text-[13px] text-err">{error}</p>}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Queued" value={String(c.queued ?? 0)} />
        <Stat label="Running" value={String(c.running ?? 0)} />
        <Stat label="Failed" value={String(c.error ?? 0)} tone={c.error ? "warn" : undefined} />
        <Stat label="Done" value={String(c.done ?? 0)} />
      </div>
      <Table head={["Job", "Workspace", "Attempts", "Created", ""]} empty={data && data.jobs.length === 0 ? "The queue is empty." : undefined}>
        {(data?.jobs ?? []).map((j) => (
          <tr key={j.id} className="align-top">
            <td className="px-4 py-3">
              <Badge tone={j.status === "error" ? "warn" : "plain"}>{j.status}</Badge> <span className="text-ink">{j.kind}</span>
              {j.error && <p className="mt-1 max-w-md text-[12px] text-err">{j.error}</p>}
            </td>
            <td className="px-4 py-3 text-muted">{j.workspace}</td>
            <td className="px-4 py-3 font-mono tabular-nums">{j.attempts}</td>
            <td className="px-4 py-3 text-muted">{ago(j.createdAt)}</td>
            <td className="px-4 py-3 text-end">
              <div className="flex justify-end gap-2">
                {j.status === "error" && (
                  <button type="button" onClick={() => void act(j.id, "retry")} className="kun-btn-secondary h-8 rounded-full px-3.5 text-[12.5px] font-medium">
                    Retry
                  </button>
                )}
                {j.status !== "running" && (
                  <button type="button" onClick={() => void act(j.id, "drop")} className="h-8 rounded-full px-3.5 text-[12.5px] text-muted hover:bg-err/10 hover:text-err">
                    Drop
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </Table>
      {!data && !error && <div className="kun-skeleton mt-3 h-24" aria-busy />}
    </AdminPage>
  );
}
