"use client";

import { useEffect, useState } from "react";
import { readJson } from "@/lib/http";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { APP_HOME } from "@/lib/routes";
import { toast } from "../Toast";
import { WorkspaceBadge } from "../shell/WorkspaceSwitcher";
import { btnPrimary, btnSecondary, inputCls, planLabel, Section } from "./ui";

const ROLES = ["owner", "admin", "editor", "viewer"];

interface Ws {
  id: string;
  name: string;
  plan: string;
  role: string;
  active: boolean;
}

export function WorkspaceSettings() {
  const { t } = useI18n();
  const [ws, setWs] = useState<Ws | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void fetch("/api/workspaces")
      .then((r) => readJson<{ workspaces: Ws[] }>(r))
      .then((j) => {
        const cur = j.workspaces.find((w) => w.active) ?? null;
        if (!live || !cur) return;
        setWs(cur);
        setName(cur.name);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!ws) return <div className="kun-skeleton h-40" aria-busy />;
  const admin = ws.role === "owner" || ws.role === "admin";
  const owner = ws.role === "owner";

  const rename = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const j = await readJson<{ name?: string; error?: string }>(res);
      if (!res.ok) throw new Error(j.error || t("settings.workspace.renameFailed"));
      setWs({ ...ws, name: j.name ?? name });
      toast(t("settings.workspace.renamed"), "ok");
      // The sidebar shows the name from the server render.
      window.location.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("settings.workspace.renameFailed"), "error");
      setSaving(false);
    }
  };

  const leaveOrDelete = async (kind: "leave" | "delete") => {
    setBusy(true);
    try {
      const res =
        kind === "delete"
          ? await fetch("/api/workspaces", {
              method: "DELETE",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ confirm }),
            })
          : await fetch("/api/workspaces/members", { method: "DELETE" });
      const j = await readJson<{ error?: string }>(res).catch(() => ({} as { error?: string }));
      if (!res.ok) throw new Error(j.error || t("settings.failed"));
      if (kind === "leave") {
        // Pick another workspace so the next page doesn't try the one just left.
        const list = await readJson<{ workspaces: Ws[] }>(await fetch("/api/workspaces"));
        const other = list.workspaces.find((w) => w.id !== ws.id);
        if (other)
          await fetch("/api/workspaces/switch", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id: other.id }),
          });
      }
      window.location.assign(APP_HOME);
    } catch (e) {
      toast(e instanceof Error ? e.message : t("settings.failed"), "error");
      setBusy(false);
    }
  };

  return (
    <>
      <Section title={t("settings.workspace.title")} description={t("settings.workspace.desc")}>
        <div className="mb-5 flex items-center gap-3">
          <WorkspaceBadge id={ws.id} name={ws.name} size={40} />
          <div>
            <p className="text-[14px] font-medium text-ink" dir="auto">{ws.name}</p>
            <p className="text-[12.5px] capitalize text-faint">
              {ROLES.includes(ws.role)
                ? t(`settings.workspace.youAre.${ws.role}` as MessageKey, { plan: planLabel(t, ws.plan) })
                : t("settings.usage.planTitle", { plan: planLabel(t, ws.plan) })}
            </p>
          </div>
        </div>
        <form
          className="max-w-sm"
          onSubmit={(e) => {
            e.preventDefault();
            void rename();
          }}
        >
          <label htmlFor="wname" className="mb-1.5 block text-[13px] font-medium text-ink">
            {t("settings.workspace.name")}
          </label>
          <input id="wname" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} disabled={!admin} dir="auto" className={inputCls} />
          {admin ? (
            <button type="submit" disabled={saving || name.trim().length < 2 || name.trim() === ws.name} className={`${btnPrimary} mt-4`}>
              {saving ? t("common.saving") : t("common.rename")}
            </button>
          ) : (
            <p className="mt-1.5 text-[12.5px] text-faint">{t("settings.workspace.adminsOnly")}</p>
          )}
        </form>
      </Section>

      <Section
        title={owner ? t("settings.workspace.deleteTitle") : t("settings.workspace.leaveTitle")}
        danger
        description={
          owner ? t("settings.workspace.deleteDesc") : t("settings.workspace.leaveDesc")
        }
      >
        {owner ? (
          <div className="max-w-sm space-y-3">
            <label htmlFor="wconfirm" className="block text-[13px] text-muted">
              {t("settings.workspace.typeToConfirm")
                .split("{name}")
                .flatMap((part, i) => (i === 0 ? [part] : [<bdi key={i} className="font-medium text-ink">{ws.name}</bdi>, part]))}
            </label>
            <input id="wconfirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} dir="auto" className={inputCls} autoComplete="off" />
            <button
              type="button"
              disabled={busy || confirm !== ws.name}
              onClick={() => void leaveOrDelete("delete")}
              className="h-10 rounded-full bg-err px-5 text-[13px] font-medium text-white transition-transform active:scale-[0.97] disabled:opacity-40"
            >
              {busy ? t("common.deleting") : t("settings.workspace.deleteBtn")}
            </button>
          </div>
        ) : (
          <button type="button" disabled={busy} onClick={() => void leaveOrDelete("leave")} className={btnSecondary}>
            {busy ? t("settings.workspace.leaving") : t("settings.workspace.leaveBtn")}
          </button>
        )}
      </Section>
    </>
  );
}
