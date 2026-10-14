"use client";

import { ago } from "@/lib/format";
import { AdminPage, Table } from "./ui";
import { useAdminData } from "./useAdminData";

interface E {
  id: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

const LABEL: Record<string, string> = {
  "workspace.plan": "Changed plan",
  "workspace.grant": "Granted credit",
  "post.feature": "Featured post",
  "post.unfeature": "Unfeatured post",
  "post.remove": "Removed post",
  "model.policy": "Changed model policy",
  "workspace.suspend": "Suspended workspace",
  "workspace.restore": "Restored workspace",
  "run.cancel": "Stopped a run",
  "job.retry": "Retried a job",
  "job.drop": "Dropped a job",
  "invite.add": "Invited people",
  "invite.remove": "Removed an invite",
  "share.revoke": "Revoked a share link",
  "settings.update": "Changed platform settings",
};

export function AuditAdmin() {
  const { data, error } = useAdminData<{ entries: E[] }>("/api/admin/audit");
  return (
    <AdminPage title="Audit log" description="Every change made from this console: who did it, to what, and when. The latest 200 entries.">
      {error && <p className="mb-3 text-[13px] text-err">{error}</p>}
      <Table head={["When", "Who", "What", "Details"]} empty={data && data.entries.length === 0 ? "Nothing yet." : undefined}>
        {(data?.entries ?? []).map((e) => (
          <tr key={e.id} className="align-top">
            <td className="whitespace-nowrap px-4 py-3 text-muted">{ago(e.createdAt)}</td>
            <td className="px-4 py-3 text-ink">{e.actorEmail}</td>
            <td className="px-4 py-3">
              <p className="text-ink">{LABEL[e.action] ?? e.action}</p>
              <p className="font-mono text-[11.5px] text-faint">{e.targetId}</p>
            </td>
            <td className="px-4 py-3 font-mono text-[11.5px] leading-relaxed text-muted">
              {e.detail ? Object.entries(e.detail).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" · ") : "—"}
            </td>
          </tr>
        ))}
      </Table>
      {!data && !error && <div className="kun-skeleton mt-3 h-24" aria-busy />}
    </AdminPage>
  );
}
