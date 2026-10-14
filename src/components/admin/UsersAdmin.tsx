"use client";

import { useState } from "react";
import { ago } from "@/lib/format";
import { AdminPage, Badge, SearchBox, Table } from "./ui";
import { useAdminData } from "./useAdminData";

interface U {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  admin: boolean;
  workspaces: { id: string; name: string; plan: string; role: string }[];
}

export function UsersAdmin() {
  const [q, setQ] = useState("");
  const { data, error } = useAdminData<{ users: U[] }>(`/api/admin/users?q=${encodeURIComponent(q)}`);
  return (
    <AdminPage
      title="Users"
      description="Everyone with an account. Accounts are created at sign-up; a platform admin is anyone listed in ADMIN_EMAILS."
      actions={<SearchBox value={q} onChange={setQ} placeholder="Search name or email" />}
    >
      {error && <p className="mb-3 text-[13px] text-err">{error}</p>}
      <Table head={["User", "Workspaces", "Joined"]} empty={data && data.users.length === 0 ? "No users match." : undefined}>
        {(data?.users ?? []).map((u) => (
          <tr key={u.id} className="align-top">
            <td className="px-4 py-3">
              <p className="text-ink">
                {u.name} {u.admin && <Badge tone="ok">admin</Badge>}
              </p>
              <p className="text-[12px] text-faint">{u.email}</p>
            </td>
            <td className="px-4 py-3">
              <ul className="space-y-1">
                {u.workspaces.map((w) => (
                  <li key={w.id} className="flex items-center gap-2 text-[12.5px] text-muted">
                    <span className="text-ink">{w.name}</span>
                    <Badge>{w.plan}</Badge>
                    <span className="text-faint">{w.role}</span>
                  </li>
                ))}
              </ul>
            </td>
            <td className="px-4 py-3 text-muted">{ago(u.createdAt)}</td>
          </tr>
        ))}
      </Table>
      {!data && !error && <div className="kun-skeleton mt-3 h-24" aria-busy />}
    </AdminPage>
  );
}
