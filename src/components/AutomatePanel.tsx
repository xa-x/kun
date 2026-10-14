"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  Eye,
  EyeSlash,
  Lightning,
  Lock,
  Plus,
  Trash,
  X,
} from "@phosphor-icons/react";
import { CRON_PRESETS, describeCron, previewCron } from "@/lib/cron-expr";
import { readJson } from "@/lib/http";
import { useI18n } from "@/lib/i18n";
import { toast } from "./Toast";

interface Automation {
  canEdit: boolean;
  canAdmin: boolean;
  plan: { label: string; schedules: boolean; webhooks: boolean; mcp: boolean };
  live: { published: boolean; publishedAt: string | null; stale: boolean };
  schedules: {
    id: string;
    cronExpr: string;
    enabled: boolean;
    nextRunAt: string | null;
    lastRunAt: string | null;
  }[];
  webhooks: { id: string; url: string; secret: string | null; enabled: boolean }[];
  keys: {
    id: string;
    name: string;
    prefix: string;
    scopes: string[];
    lastUsedAt: string | null;
  }[];
}

type DateFmt = (d: Date | string | number, opts?: Intl.DateTimeFormatOptions) => string;

const utc = (iso: string | null, date: DateFmt) =>
  iso
    ? `${date(iso, {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      })} UTC`
    : "—";

async function copyText(text: string, done: string, failed: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast(done, "ok");
  } catch {
    toast(failed, "error");
  }
}

function Section({
  title,
  hint,
  locked,
  children,
}: {
  title: string;
  hint: React.ReactNode;
  /** Names the plan that unlocks it, if this one does not include it. */
  locked?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-line px-4 py-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[13.5px] font-medium text-ink">{title}</h3>
        {locked && (
          <Link
            href="/billing"
            className="flex shrink-0 items-center gap-1 rounded-full bg-ink/8 px-2.5 py-1 text-[11px] text-muted transition-colors hover:text-ink"
          >
            <Lock size={11} weight="bold" aria-hidden />
            {locked}
          </Link>
        )}
      </div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{hint}</p>
      <div className={`mt-3.5 space-y-3 ${locked ? "pointer-events-none opacity-45" : ""}`}>
        {children}
      </div>
    </section>
  );
}

/** A value you copy: an address, a secret. */
function CopyField({
  value,
  secret = false,
  label,
}: {
  value: string;
  secret?: boolean;
  label: string;
}) {
  const { t } = useI18n();
  const [shown, setShown] = useState(!secret);
  return (
    <div className="flex items-center gap-1 rounded-xl border border-line bg-sunken ps-3 pe-1">
      <span className="sr-only">{label}</span>
      <input
        readOnly
        dir="ltr"
        aria-label={label}
        value={shown ? value : "•".repeat(Math.min(value.length, 24))}
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 bg-transparent py-2 text-start font-mono text-[11.5px] text-ink outline-none"
      />
      {secret && (
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? t("editor.automate.hideLabel", { label }) : t("editor.automate.showLabel", { label })}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-faint transition-colors hover:bg-ink/8 hover:text-ink"
        >
          {shown ? <EyeSlash size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
        </button>
      )}
      <button
        type="button"
        onClick={() =>
          void copyText(
            value,
            t("editor.automate.copiedLabel", { label }),
            t("editor.automate.copyFailed"),
          )
        }
        aria-label={t("editor.automate.copyLabel", { label })}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-faint transition-colors hover:bg-ink/8 hover:text-ink"
      >
        <Copy size={14} aria-hidden />
      </button>
    </div>
  );
}

/** A snippet to paste. */
function Code({ code, label }: { code: string; label: string }) {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  return (
    <div className="group relative">
      <pre dir="ltr" className="nowheel max-h-44 overflow-auto rounded-xl border border-line bg-sunken p-3 pr-10 font-mono text-[11px] leading-relaxed text-ink/85">
        {code}
      </pre>
      <button
        type="button"
        aria-label={t("editor.automate.copyLabel", { label })}
        onClick={async () => {
          await copyText(
            code,
            t("editor.automate.copiedLabel", { label }),
            t("editor.automate.copyFailed"),
          );
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        }}
        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-raised/90 text-faint transition-colors hover:text-ink"
      >
        {done ? <Check size={13} weight="bold" aria-hidden /> : <Copy size={13} aria-hidden />}
      </button>
    </div>
  );
}

const btn =
  "kun-btn-secondary inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[12.5px] font-medium transition-transform active:scale-[0.97] disabled:opacity-50";

/**
 * Run this project without opening it: on a schedule, from another service, from
 * your own code, or from an AI agent. The live version is what they all run, so
 * the panel starts there.
 */
export function AutomatePanel({
  graphId,
  inputNames,
  saveFirst,
  onClose,
}: {
  graphId: string;
  /** Names of this project's Text and Instruction nodes, for the examples. */
  inputNames: string[];
  /** Saves the canvas so what is published is what is on screen. */
  saveFirst: () => Promise<void>;
  onClose: () => void;
}) {
  const { t, tn, ago, date } = useI18n();
  const [data, setData] = useState<Automation | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [cron, setCron] = useState("0 9 * * *");
  const [keyName, setKeyName] = useState("");
  const [fresh, setFresh] = useState<{ name: string; token: string } | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/graphs/${graphId}/automation`);
      if (!res.ok) throw new Error();
      setData(await readJson<Automation>(res));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [graphId]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  /** One mutation: call, report the server's own message on failure, reload. */
  const act = async (id: string, fn: () => Promise<Response>, done?: string) => {
    setBusy(id);
    try {
      const res = await fn();
      if (!res.ok) {
        const j = await readJson<{ error?: string }>(res).catch(() => ({} as { error?: string }));
        throw new Error(j.error || t("common.tryAgainLater"));
      }
      if (done) toast(done, "ok");
      await load();
      return res;
    } catch (e) {
      toast(e instanceof Error ? e.message : t("common.tryAgainLater"), "error");
    } finally {
      setBusy(null);
    }
  };

  const json = (method: string, body: unknown) => ({
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const cronPreview = useMemo(() => previewCron(cron.trim()), [cron]);
  const words = { t, tn };
  const first = inputNames[0] ?? "Text";
  const example = inputNames.length
    ? `{"${first}": "Write something worth reading"}`
    : "{}";

  if (failed)
    return (
      <PanelShell onClose={onClose}>
        <p className="px-4 py-6 text-[13px] text-muted">{t("editor.automate.loadFailed")}</p>
      </PanelShell>
    );
  if (!data)
    return (
      <PanelShell onClose={onClose}>
        <div className="space-y-3 px-4 py-5" aria-busy>
          {[0, 1, 2].map((i) => (
            <div key={i} className="kun-skeleton h-24" />
          ))}
        </div>
      </PanelShell>
    );

  const upgrade = (ok: boolean) => (ok ? undefined : t("editor.automate.proAndTeam"));
  const canEdit = data.canEdit;

  return (
    <PanelShell onClose={onClose}>
      {/* The version everything below runs. */}
      <section className="px-4 pb-5 pt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[13px] text-ink">
            <span
              aria-hidden
              className={`h-2 w-2 rounded-full ${
                !data.live.published ? "bg-faint" : data.live.stale ? "bg-warn" : "bg-ok"
              }`}
            />
            {!data.live.published
              ? t("editor.automate.notPublished")
              : data.live.stale
                ? t("editor.automate.changesNotLive")
                : t("editor.automate.liveCurrent")}
          </p>
          <button
            type="button"
            disabled={!canEdit || busy === "publish" || (data.live.published && !data.live.stale)}
            onClick={() =>
              void act(
                "publish",
                async () => {
                  await saveFirst();
                  return fetch(`/api/graphs/${graphId}/publish`, { method: "POST" });
                },
                t("editor.automate.published"),
              )
            }
            className="kun-btn-primary inline-flex h-9 items-center rounded-full px-4 text-[12.5px] font-medium transition-transform active:scale-[0.97] disabled:opacity-50"
          >
            {busy === "publish" ? t("editor.automate.publishing") : t("editor.automate.publishChanges")}
          </button>
        </div>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
          {t("editor.automate.liveNote")}
          {data.live.publishedAt &&
            ` ${t("editor.automate.publishedAgo", { when: ago(data.live.publishedAt) })}`}
        </p>
      </section>

      <Section
        title={t("editor.automate.schedule")}
        hint={t("editor.automate.scheduleHint")}
        locked={upgrade(data.plan.schedules)}
      >
        {data.schedules.length === 0 && (
          <p className="text-[12.5px] text-faint">{t("editor.automate.noSchedules")}</p>
        )}
        {data.schedules.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5"
          >
            <button
              type="button"
              role="switch"
              aria-checked={s.enabled}
              aria-label={t(s.enabled ? "editor.automate.pause" : "editor.automate.resume", {
                what: describeCron(s.cronExpr, words),
              })}
              disabled={!canEdit || busy === s.id}
              onClick={() =>
                void act(s.id, () =>
                  fetch(`/api/graphs/${graphId}/schedule`, json("PATCH", { id: s.id, enabled: !s.enabled })),
                )
              }
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                s.enabled ? "bg-ok/70" : "bg-ink/15"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                  s.enabled ? "start-[18px]" : "start-0.5"
                }`}
              />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-ink">{describeCron(s.cronExpr, words)}</p>
              <p className="truncate text-[11.5px] text-faint">
                {s.enabled
                  ? t("editor.automate.next", { when: utc(s.nextRunAt, date) })
                  : t("editor.automate.paused")}
                {s.lastRunAt && ` · ${t("editor.automate.lastRun", { when: ago(s.lastRunAt) })}`}
              </p>
            </div>
            {canEdit && (
              <button
                type="button"
                aria-label={t("editor.automate.deleteSchedule")}
                onClick={() =>
                  void act(s.id, () => fetch(`/api/graphs/${graphId}/schedule?id=${s.id}`, { method: "DELETE" }))
                }
                className="flex h-7 w-7 items-center justify-center rounded-lg text-faint transition-colors hover:bg-ink/8 hover:text-err"
              >
                <Trash size={14} aria-hidden />
              </button>
            )}
          </div>
        ))}
        {canEdit && (
          <div className="space-y-2.5">
            <div className="flex flex-wrap gap-1.5">
              {CRON_PRESETS.map((p) => (
                <button
                  key={p.expr}
                  type="button"
                  onClick={() => setCron(p.expr)}
                  aria-pressed={cron === p.expr}
                  className={`rounded-full border px-3 py-1 text-[12px] transition-colors active:scale-[0.97] ${
                    cron === p.expr
                      ? "border-ink/50 bg-ink/10 text-ink"
                      : "border-line text-muted hover:border-line2 hover:text-ink"
                  }`}
                >
                  {t(p.key)}
                </button>
              ))}
            </div>
            <label className="block">
              <span className="sr-only">{t("editor.automate.cronLabel")}</span>
              <input
                value={cron}
                onChange={(e) => setCron(e.target.value)}
                spellCheck={false}
                dir="ltr"
                placeholder={t("editor.automate.cronPlaceholder")}
                aria-describedby="cron-next"
                className="kun-input text-start font-mono !text-[12px]"
              />
            </label>
            <p
              id="cron-next"
              className={`text-[12px] ${"error" in cronPreview ? "text-err" : "text-muted"}`}
            >
              {"error" in cronPreview
                ? t("editor.cron.invalid")
                : t("editor.automate.nextColon", { when: utc(cronPreview.next.toISOString(), date) })}
            </p>
            <button
              type="button"
              disabled={"error" in cronPreview || busy === "add-schedule"}
              onClick={() =>
                void act(
                  "add-schedule",
                  () => fetch(`/api/graphs/${graphId}/schedule`, json("POST", { cronExpr: cron.trim() })),
                  t("editor.automate.scheduleAdded"),
                )
              }
              className={btn}
            >
              <Plus size={13} weight="bold" aria-hidden />
              {t("editor.automate.addSchedule")}
            </button>
          </div>
        )}
      </Section>

      <Section
        title={t("editor.automate.webhook")}
        hint={
          inputNames.length
            ? t("editor.automate.webhookHintExample", { example: `\u2066${example}\u2069` })
            : t("editor.automate.webhookHint")
        }
        locked={upgrade(data.plan.webhooks)}
      >
        {data.webhooks.map((w) => {
          const url = `${origin}${w.url}`;
          return (
            <div key={w.id} className="space-y-2.5">
              <CopyField label={t("editor.automate.webhookUrl")} value={url} />
              {w.secret ? (
                <CopyField label={t("editor.automate.secret")} value={w.secret} secret />
              ) : (
                <p className="text-[12px] text-faint">{t("editor.automate.secretHidden")}</p>
              )}
              <Code
                label={t("editor.automate.example")}
                code={`curl -X POST "${url}" \\\n  -H "Authorization: Bearer $KUN_WEBHOOK_SECRET" \\\n  -H "Content-Type: application/json" \\\n  -d '${example}'`}
              />
              {canEdit && (
                <button
                  type="button"
                  onClick={() =>
                    void act(w.id, () => fetch(`/api/graphs/${graphId}/webhook?id=${w.id}`, { method: "DELETE" }), t("editor.automate.webhookRemoved"))
                  }
                  className="inline-flex items-center gap-1.5 text-[12px] text-faint transition-colors hover:text-err"
                >
                  <Trash size={13} aria-hidden />
                  {t("editor.automate.removeWebhook")}
                </button>
              )}
            </div>
          );
        })}
        {data.webhooks.length === 0 && canEdit && (
          <button
            type="button"
            disabled={busy === "add-hook"}
            onClick={() =>
              void act("add-hook", () => fetch(`/api/graphs/${graphId}/webhook`, { method: "POST" }), t("editor.automate.webhookCreated"))
            }
            className={btn}
          >
            <Plus size={13} weight="bold" aria-hidden />
            {t("editor.automate.createWebhook")}
          </button>
        )}
      </Section>

      <Section
        title={t("editor.automate.api")}
        hint={t("editor.automate.apiHint")}
      >
        {fresh && (
          <div role="status" className="space-y-2 rounded-xl border border-ok/40 bg-ok/5 p-3">
            <p className="text-[12.5px] font-medium text-ink">
              {t("editor.automate.newKeyShown", { name: `\u2068${fresh.name}\u2069` })}
            </p>
            <CopyField label={t("editor.automate.apiKey")} value={fresh.token} secret />
            <button
              type="button"
              onClick={() => setFresh(null)}
              className="text-[12px] text-muted transition-colors hover:text-ink"
            >
              {t("editor.automate.savedIt")}
            </button>
          </div>
        )}
        {data.keys.length === 0 && !fresh && (
          <p className="text-[12.5px] text-faint">{t("editor.automate.noKeys")}</p>
        )}
        {data.keys.map((k) => (
          <div
            key={k.id}
            className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p dir="auto" className="truncate text-[13px] text-ink">{k.name}</p>
              <p className="truncate text-[11px] text-faint">
                <bdi className="font-mono">
                  {k.prefix}… · {k.scopes.join(", ")}
                </bdi>{" "}
                · {k.lastUsedAt ? t("editor.automate.usedAgo", { when: ago(k.lastUsedAt) }) : t("editor.automate.neverUsed")}
              </p>
            </div>
            {data.canAdmin && (
              <button
                type="button"
                aria-label={t("editor.automate.deleteKey", { name: k.name })}
                onClick={() =>
                  void act(k.id, () => fetch(`/api/keys?id=${k.id}`, { method: "DELETE" }), t("editor.automate.keyDeleted"))
                }
                className="flex h-7 w-7 items-center justify-center rounded-lg text-faint transition-colors hover:bg-ink/8 hover:text-err"
              >
                <Trash size={14} aria-hidden />
              </button>
            )}
          </div>
        ))}
        {data.canAdmin ? (
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const name = keyName.trim() || t("editor.automate.keyDefaultName");
              const res = await act("add-key", () => fetch("/api/keys", json("POST", { name })));
              if (res) {
                const j = await readJson<{ token?: string }>(res.clone()).catch(() => ({} as { token?: string }));
                if (j.token) setFresh({ name, token: j.token });
                setKeyName("");
              }
            }}
          >
            <input
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              aria-label={t("editor.automate.keyName")}
              placeholder={t("editor.automate.keyNamePlaceholder")}
              dir="auto"
              className="kun-input !text-[12.5px]"
            />
            <button type="submit" disabled={busy === "add-key"} className={`${btn} shrink-0`}>
              <Plus size={13} weight="bold" aria-hidden />
              {t("editor.automate.newKey")}
            </button>
          </form>
        ) : (
          <p className="text-[12px] text-faint">{t("editor.automate.adminsOnly")}</p>
        )}
        <Code
          label={t("editor.automate.example")}
          code={`# start a run\ncurl -X POST ${origin}/api/runs \\\n  -H "Authorization: Bearer $KUN_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"graphId":"${graphId}","input":${example}}'\n# → {"runId":"…","status":"queued"}\n\n# read it back: status, per-node results, and "result"\ncurl ${origin}/api/runs/RUN_ID \\\n  -H "Authorization: Bearer $KUN_API_KEY"`}
        />
      </Section>

      <Section
        title={t("editor.automate.mcp")}
        hint={t("editor.automate.mcpHint")}
        locked={upgrade(data.plan.mcp)}
      >
        <CopyField label={t("editor.automate.mcpAddress")} value={`${origin}/api/mcp`} />
        <Code
          label={t("editor.automate.claudeCommand")}
          code={`claude mcp add --transport http kun ${origin}/api/mcp \\\n  --header "Authorization: Bearer $KUN_API_KEY"`}
        />
        <Code
          label={t("editor.automate.otherClients")}
          code={JSON.stringify(
            {
              mcpServers: {
                kun: {
                  url: `${origin}/api/mcp`,
                  headers: { Authorization: "Bearer YOUR_API_KEY" },
                },
              },
            },
            null,
            2,
          )}
        />
        <p className="text-[12px] leading-relaxed text-faint">
          {t("editor.automate.mcpTools")}
        </p>
      </Section>
    </PanelShell>
  );
}

function PanelShell({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <aside
      aria-label={t("editor.automate.title")}
      className="kun-pop z-30 flex min-h-0 w-[388px] shrink-0 flex-col border-s border-line bg-card max-md:absolute max-md:inset-x-0 max-md:bottom-0 max-md:h-[72%] max-md:w-full max-md:rounded-t-2xl max-md:border-s-0 max-md:border-t max-md:shadow-[0_-24px_48px_-24px_rgba(0,0,0,0.65)]"
    >
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink/8 text-ink">
            <Lightning size={14} weight="fill" aria-hidden />
          </span>
          <div>
            <p className="text-[13.5px] font-medium leading-none text-ink">{t("editor.automate.title")}</p>
            <p className="mt-1 text-[11px] leading-none text-faint">
              {t("editor.automate.subtitle")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          className="flex h-8 w-8 items-center justify-center rounded-full text-faint transition-colors hover:bg-ink/8 hover:text-ink"
        >
          <X size={14} weight="bold" aria-hidden />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </aside>
  );
}
