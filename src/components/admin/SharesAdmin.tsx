"use client";

import { ago } from "@/lib/format";
import { toast } from "../Toast";
import { AdminPage, Badge, Table } from "./ui";
import { useAdminData } from "./useAdminData";

interface S {
  id: string;
  token: string;
  permission: string;
  project: string;
  workspace: string;
  expiresAt: string | null;
  createdAt: string;
}

export function SharesAdmin() {
  const { data, error, reload } = useAdminData<{ shares: S[] }>("/api/admin/shares");
  const revoke = async (id: string) => {
    const res = await fetch(`/api/admin/shares?id=${id}`, { method: "DELETE" });
    if (!res.ok) return toast("Couldn’t revoke it.", "error");
    toast("Link revoked.", "ok");
    await reload();
  };
  return (
    <AdminPage title="Share links" description="Every public link that works right now. Revoke one if it exposes something it shouldn't.">
      {error && <p className="mb-3 text-[13px] text-err">{error}</p>}
      <Table head={["Project", "Workspace", "Access", "Created", "Expires", ""]} empty={data && data.shares.length === 0 ? "No active links." : undefined}>
        {(data?.shares ?? []).map((s) => (
          <tr key={s.id}>
            <td className="px-4 py-3">
              <a href={`/s/${s.token}`} target="_blank" rel="noopener noreferrer" className="text-ink underline decoration-line2 underline-offset-2 hover:decoration-ink">
                {s.project || "Untitled"}
              </a>
            </td>
            <td className="px-4 py-3 text-muted">{s.workspace}</td>
            <td className="px-4 py-3">
              <Badge tone={s.permission === "view" ? "plain" : "warn"}>{s.permission}</Badge>
            </td>
            <td className="px-4 py-3 text-muted">{ago(s.createdAt)}</td>
            <td className="px-4 py-3 text-muted">{s.expiresAt ? new Date(s.expiresAt).toLocaleDateString() : "never"}</td>
            <td className="px-4 py-3 text-end">
              <button type="button" onClick={() => void revoke(s.id)} className="h-8 rounded-full px-3.5 text-[12.5px] text-muted hover:bg-err/10 hover:text-err">
                Revoke
              </button>
            </td>
          </tr>
        ))}
      </Table>
      {!data && !error && <div className="kun-skeleton mt-3 h-24" aria-busy />}
    </AdminPage>
  );
}
