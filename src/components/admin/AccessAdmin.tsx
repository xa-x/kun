"use client";

import { useState } from "react";
import { ago } from "@/lib/format";
import { readJson } from "@/lib/http";
import { toast } from "../Toast";
import { AdminPage, Badge, Table } from "./ui";
import { useAdminData } from "./useAdminData";

interface Inv {
  email: string;
  note: string | null;
  createdAt: string;
  joined: boolean;
}

export function AccessAdmin() {
  const { data, error, reload } = useAdminData<{ invites: Inv[]; fixed: { email: string; source: string; joined: boolean }[] }>("/api/admin/invites");
  const settings = useAdminData<{ settings: { signupOpen: boolean } }>("/api/admin/settings");
  const [emails, setEmails] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/invites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ emails, note }) });
      const j = await readJson<{ added?: number; error?: string }>(res);
      if (!res.ok) throw new Error(j.error || "Failed");
      toast(`Invited ${j.added}.`, "ok");
      setEmails("");
      setNote("");
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (email: string) => {
    await fetch(`/api/admin/invites?email=${encodeURIComponent(email)}`, { method: "DELETE" });
    await reload();
  };
  const open = settings.data?.settings.signupOpen;
  const toggle = async () => {
    const res = await fetch("/api/admin/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ signupOpen: !open }) });
    if (!res.ok) return toast("Couldn’t change sign-up.", "error");
    toast(!open ? "Sign-up is open to everyone." : "Sign-up is invite-only.", "ok");
    await settings.reload();
  };

  return (
    <AdminPage title="Access and invites" description="Who can create an account. While sign-up is invite-only, only the emails below (plus admins) can register.">
      {error && <p className="mb-3 text-[13px] text-err">{error}</p>}

      <section className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-card/60 p-5">
        <div>
          <p className="text-[14px] font-medium text-ink">Sign-up is {open === undefined ? "…" : open ? "open to everyone" : "invite-only"}</p>
          <p className="mt-1 text-[12.5px] text-muted">Takes effect immediately. Existing accounts are not affected.</p>
        </div>
        <button type="button" onClick={() => void toggle()} disabled={open === undefined} className="kun-btn-secondary h-10 rounded-full px-5 text-[13px] font-medium disabled:opacity-50">
          {open ? "Make invite-only" : "Open sign-up"}
        </button>
      </section>

      <form
        className="mb-8 grid gap-3 md:grid-cols-[1fr_220px_auto] md:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <div>
          <label htmlFor="inv" className="mb-1.5 block text-[13px] font-medium text-ink">
            Invite by email
          </label>
          <input id="inv" value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="name@company.com, another@company.com" className="kun-input" />
        </div>
        <div>
          <label htmlFor="note" className="mb-1.5 block text-[13px] font-medium text-ink">
            Note <span className="font-normal text-faint">(optional)</span>
          </label>
          <input id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} className="kun-input" />
        </div>
        <button type="submit" disabled={busy || !emails.trim()} className="kun-btn-primary h-11 rounded-full px-6 text-[13px] font-medium disabled:opacity-50">
          {busy ? "Inviting…" : "Invite"}
        </button>
      </form>

      <h2 className="mb-3 text-[12px] font-medium uppercase tracking-[0.12em] text-faint">Invited</h2>
      <Table head={["Email", "Note", "Invited", "Status", ""]} empty={data && data.invites.length === 0 ? "No invites yet." : undefined}>
        {(data?.invites ?? []).map((i) => (
          <tr key={i.email}>
            <td className="px-4 py-3 text-ink">{i.email}</td>
            <td className="px-4 py-3 text-muted">{i.note ?? "—"}</td>
            <td className="px-4 py-3 text-muted">{ago(i.createdAt)}</td>
            <td className="px-4 py-3">{i.joined ? <Badge tone="ok">joined</Badge> : <Badge>waiting</Badge>}</td>
            <td className="px-4 py-3 text-end">
              <button type="button" onClick={() => void remove(i.email)} className="h-8 rounded-full px-3.5 text-[12.5px] text-muted hover:bg-err/10 hover:text-err">
                Remove
              </button>
            </td>
          </tr>
        ))}
      </Table>

      <h2 className="mb-3 mt-8 text-[12px] font-medium uppercase tracking-[0.12em] text-faint">Always allowed (set in the server environment)</h2>
      <Table head={["Email", "Source", "Status"]}>
        {(data?.fixed ?? []).map((f) => (
          <tr key={f.email}>
            <td className="px-4 py-3 text-ink">{f.email}</td>
            <td className="px-4 py-3 text-muted">{f.source === "admin" ? "ADMIN_EMAILS" : "INVITED_EMAILS"}</td>
            <td className="px-4 py-3">{f.joined ? <Badge tone="ok">joined</Badge> : <Badge>waiting</Badge>}</td>
          </tr>
        ))}
      </Table>
    </AdminPage>
  );
}
