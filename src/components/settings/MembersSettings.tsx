"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Trash, UsersThree } from "@phosphor-icons/react";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { readJson } from "@/lib/http";
import { ASSIGNABLE_ROLES, type Role } from "@/lib/members";
import { toast } from "../Toast";
import { btnPrimary, inputCls, Meter, Section } from "./ui";

interface Member {
  userId: string;
  name: string;
  email: string;
  role: Role;
  joinedAt: string;
  you: boolean;
}
interface Invite {
  id: string;
  role: Role;
  email: string | null;
  url: string;
  expiresAt: string;
}

export function MembersSettings() {
  const { t, ago, date } = useI18n();
  const roleName = (r: Role) => t(`settings.role.${r}` as MessageKey);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [seats, setSeats] = useState<{ limit: number } | null>(null);
  const [role, setRole] = useState<Role>("editor");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, i, u] = await Promise.all([
        readJson<{ members: Member[]; canManage: boolean }>(await fetch("/api/workspaces/members")),
        readJson<{ invites: Invite[] }>(await fetch("/api/workspaces/invites")),
        readJson<{ meters: { members: { limit: number } } }>(await fetch("/api/workspaces/usage")),
      ]);
      setMembers(m.members);
      setCanManage(m.canManage);
      setInvites(i.invites);
      setSeats(u.meters.members);
    } catch {
      toast(t("settings.members.loadFailed"), "error");
      setMembers([]);
    }
  }, [t]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const call = async (fn: () => Promise<Response>, done?: string) => {
    setBusy(true);
    try {
      const res = await fn();
      const j = await readJson<{ error?: string; url?: string }>(res).catch(() => ({} as { error?: string; url?: string }));
      if (!res.ok) throw new Error(j.error || t("settings.failed"));
      if (done) toast(done, "ok");
      await load();
      return j;
    } catch (e) {
      toast(e instanceof Error ? e.message : t("settings.failed"), "error");
    } finally {
      setBusy(false);
    }
  };
  const json = (method: string, body: unknown) => ({
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${url}`);
      toast(t("settings.invite.copied"), "ok");
    } catch {
      toast(t("settings.invite.copyFailed"), "error");
    }
  };

  if (!members || !seats) return <div className="kun-skeleton h-48" aria-busy />;
  const solo = seats.limit <= 1;

  return (
    <>
      <Section title={t("settings.members.title")} description={t("settings.members.desc")}>
        <Meter label={t("settings.members.seats")} used={members.length} limit={seats.limit} />
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {members.map((m) => (
            <li key={m.userId} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/10 text-[12px] font-semibold text-ink">
                {(m.name || m.email)[0]?.toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] text-ink">
                  <bdi>{m.name || m.email}</bdi> {m.you && <span className="text-faint">{t("settings.members.you")}</span>}
                </p>
                <p className="truncate text-[12px] text-faint">
                  <bdi dir="ltr">{m.email}</bdi> · {t("settings.members.joined", { when: ago(m.joinedAt) })}
                </p>
              </div>
              {m.role === "owner" || !canManage || m.you ? (
                <span className="rounded-full bg-ink/8 px-3 py-1 text-[12px] capitalize text-muted">{roleName(m.role)}</span>
              ) : (
                <>
                  <label className="sr-only" htmlFor={`r-${m.userId}`}>
                    {t("settings.members.roleFor", { name: m.name || m.email })}
                  </label>
                  <select
                    id={`r-${m.userId}`}
                    value={m.role}
                    disabled={busy}
                    onChange={(e) => void call(() => fetch("/api/workspaces/members", json("PATCH", { userId: m.userId, role: e.target.value })), t("settings.members.roleUpdated"))}
                    className="kun-input !h-9 !w-auto !text-[13px] capitalize"
                  >
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {roleName(r)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    aria-label={t("settings.members.removeAria", { name: m.name || m.email })}
                    onClick={() => void call(() => fetch(`/api/workspaces/members?userId=${m.userId}`, { method: "DELETE" }), t("settings.members.removed"))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-faint transition-colors hover:bg-err/10 hover:text-err"
                  >
                    <Trash size={15} aria-hidden />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t("settings.invite.title")} description={t("settings.invite.desc")}>
        {solo ? (
          <div className="flex items-start gap-3 rounded-xl border border-line p-4">
            <UsersThree size={20} className="mt-0.5 shrink-0 text-faint" aria-hidden />
            <div>
              <p className="text-[13.5px] text-ink">{t("settings.invite.soloTitle")}</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                {t("settings.invite.soloBody")}{" "}
                <Link href="/billing" className="text-ink underline underline-offset-2">
                  {t("settings.invite.seePlans")}
                </Link>
              </p>
            </div>
          </div>
        ) : canManage ? (
          <>
            <form
              className="flex max-w-xl flex-wrap items-end gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const j = await call(() => fetch("/api/workspaces/invites", json("POST", { role, email: email.trim() || undefined })));
                if (j?.url) {
                  setEmail("");
                  await copy(j.url);
                }
              }}
            >
              <div className="min-w-[200px] flex-1">
                <label htmlFor="inv-email" className="mb-1.5 block text-[13px] font-medium text-ink">
                  {t("settings.invite.email")} <span className="font-normal text-faint">{t("settings.invite.emailOptional")}</span>
                </label>
                <input id="inv-email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className={`${inputCls} text-start`} />
              </div>
              <div>
                <label htmlFor="inv-role" className="mb-1.5 block text-[13px] font-medium text-ink">
                  {t("settings.invite.role")}
                </label>
                <select id="inv-role" value={role} onChange={(e) => setRole(e.target.value as Role)} className="kun-input !w-auto capitalize">
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {roleName(r)}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" disabled={busy} className={btnPrimary}>
                {t("settings.invite.create")}
              </button>
            </form>
            <p className="mt-2 text-[12.5px] text-faint">{t(`settings.roleHelp.${role}` as MessageKey)}</p>
            {invites.length > 0 && (
              <ul className="mt-5 divide-y divide-line border-y border-line">
                {invites.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-ink">
                        {i.email ? <bdi dir="ltr">{i.email}</bdi> : t("settings.invite.anyone")} <span className="text-faint">· {roleName(i.role)}</span>
                      </p>
                      <p className="text-[12px] text-faint">{t("settings.invite.expires", { date: date(i.expiresAt) })}</p>
                    </div>
                    <button type="button" aria-label={t("settings.invite.copyAria")} onClick={() => void copy(i.url)} className="flex h-8 w-8 items-center justify-center rounded-lg text-faint hover:bg-ink/8 hover:text-ink">
                      <Copy size={15} aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={t("settings.invite.cancelAria")}
                      onClick={() => void call(() => fetch(`/api/workspaces/invites?id=${i.id}`, { method: "DELETE" }), t("settings.invite.cancelled"))}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-faint hover:bg-err/10 hover:text-err"
                    >
                      <Trash size={15} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-[13px] text-muted">{t("settings.invite.adminsOnly")}</p>
        )}
      </Section>
    </>
  );
}
