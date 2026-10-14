"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CaretUpDown, Plus } from "@phosphor-icons/react";
import { readJson } from "@/lib/http";
import { APP_HOME } from "@/lib/routes";
import { toast } from "../Toast";
import { useI18n } from "@/lib/i18n";
import { planName } from "./plan";

interface Workspace {
  id: string;
  name: string;
  plan: string;
  role: string;
  active: boolean;
}

const tint = (id: string) => {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 38% 34%)`;
};

/** The workspace badge: a tinted initial, so workspaces are told apart at a glance. */
export function WorkspaceBadge({ id, name, size = 28 }: { id: string; name: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{ background: tint(id), width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-lg text-[12px] font-semibold text-white/90"
    >
      {(name.trim()[0] ?? "W").toUpperCase()}
    </span>
  );
}

/**
 * Pick, create or leave a workspace. Switching sets a cookie and reloads, so
 * every server-rendered page and request moves to the new workspace together.
 */
export function WorkspaceSwitcher({ current }: { current: { id: string; name: string; plan: string } }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Workspace[] | null>(null);
  const [canCreate, setCanCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setCreating(false);
    setName("");
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetch("/api/workspaces")
      .then((r) => readJson<{ workspaces: Workspace[]; canCreate: boolean }>(r))
      .then((j) => {
        if (cancelled) return;
        setList(j.workspaces);
        setCanCreate(j.canCreate);
      })
      .catch(() => {});
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const go = async (url: string, body: unknown) => {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await readJson<{ error?: string }>(res).catch(() => ({} as { error?: string }));
        throw new Error(j.error || t("shell.workspace.failed"));
      }
      window.location.assign(APP_HOME);
    } catch (e) {
      toast(e instanceof Error ? e.message : t("shell.workspace.failed"), "error");
      setBusy(false);
    }
  };

  return (
    <div ref={ref} className="relative mb-4">
      {open && (
        <div
          role="menu"
          aria-label={t("shell.workspace.list")}
          className="kun-pop absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-line2 bg-raised p-1.5 shadow-2xl shadow-black/40"
        >
          <p className="px-3 pb-1 pt-1.5 text-[11px] uppercase tracking-[0.12em] text-faint">
            {t("shell.workspace.list")}
          </p>
          {(list ?? [{ ...current, role: "", active: true }]).map((w) => (
            <button
              key={w.id}
              type="button"
              role="menuitemradio"
              aria-checked={w.active}
              disabled={busy}
              onClick={() => (w.active ? close() : void go("/api/workspaces/switch", { id: w.id }))}
              className="flex h-11 w-full items-center gap-2.5 rounded-xl px-2.5 text-start transition-colors hover:bg-ink/5 disabled:opacity-60"
            >
              <WorkspaceBadge id={w.id} name={w.name} size={26} />
              <span className="min-w-0 flex-1">
                <span dir="auto" className="block truncate text-[13px] text-ink">{w.name}</span>
                <span className="block text-[11px] capitalize text-faint">{planName(t, w.plan)}</span>
              </span>
              {w.active && <Check size={14} weight="bold" className="text-ink" aria-hidden />}
            </button>
          ))}
          <div className="mt-1 border-t border-line pt-1">
            {creating ? (
              <form
                className="flex gap-1.5 p-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void go("/api/workspaces", { name });
                }}
              >
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-label={t("shell.workspace.name")}
                  placeholder={t("shell.workspace.name")}
                  dir="auto"
                  maxLength={40}
                  className="kun-input !h-9 !text-[13px]"
                />
                <button
                  type="submit"
                  disabled={busy || name.trim().length < 2}
                  className="kun-btn-primary h-9 shrink-0 rounded-full px-3.5 text-[12.5px] font-medium disabled:opacity-50"
                >
                  {t("common.create")}
                </button>
              </form>
            ) : (
              <button
                type="button"
                disabled={!canCreate}
                onClick={() => setCreating(true)}
                className="flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-start text-[13px] text-muted transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-50"
              >
                <Plus size={14} weight="bold" aria-hidden />
                {canCreate ? t("shell.workspace.new") : t("shell.workspace.limit")}
              </button>
            )}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-2xl border border-line bg-card/60 p-2 text-start transition-colors hover:border-line2"
      >
        <WorkspaceBadge id={current.id} name={current.name} />
        <span className="min-w-0 flex-1">
          <span dir="auto" className="block truncate text-[13px] font-medium text-ink">{current.name}</span>
          <span className="block truncate text-[11px] capitalize text-faint">{t("shell.account.planName", { plan: planName(t, current.plan) })}</span>
        </span>
        <CaretUpDown size={14} className="shrink-0 text-faint" aria-hidden />
      </button>
    </div>
  );
}
