"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PaperPlaneTilt, Sparkle, X } from "@phosphor-icons/react";
import { nodeDef } from "@/lib/nodes";
import { useI18n } from "@/lib/i18n";
import { nodeLabel } from "@/lib/i18n/nodes";
import {
  applyGraphOps,
  type AssistantMention,
  type AssistantMessage,
  type GraphOp,
} from "@/lib/assistant";
import type { GraphDoc } from "@/lib/types";
import { toast } from "./Toast";

interface ChatRow extends AssistantMessage {
  id: string;
}

const STARTERS = [
  "editor.assistant.starter1",
  "editor.assistant.starter2",
  "editor.assistant.starter3",
] as const;

export function AssistantPanel({
  graphId,
  graph,
  selectedNodeIds,
  onApply,
  onClose,
  autoPrompt,
}: {
  graphId: string;
  graph: GraphDoc;
  /** Sent once on open: the first-run prompt typed on the Projects page. */
  autoPrompt?: string;
  selectedNodeIds?: string[];
  onApply: (next: GraphDoc) => void;
  onClose: () => void;
}) {
  const { t, num } = useI18n();
  const storageKey = `kun.assistant.${graphId}`;
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [draft, setDraft] = useState("");
  const [mentions, setMentions] = useState<AssistantMention[]>([]);
  const [busy, setBusy] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQ, setMentionQ] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ChatRow[];
      // Restored after mount so the server and first client render agree.
      // Never replace a conversation that is already under way (the first-run
      // prompt can be sent before this restore lands).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Array.isArray(parsed)) setRows((cur) => (cur.length ? cur : parsed));
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify(rows));
  }, [rows, storageKey]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [rows, busy]);

  const candidates = useMemo(() => {
    const q = mentionQ.toLowerCase();
    return graph.nodes
      .map((n) => ({
        id: n.id,
        label: n.data.label || nodeLabel(t, n.data.kind, nodeDef(n.data.kind)?.label ?? n.data.kind),
        kind: n.data.kind,
        color: nodeDef(n.data.kind)?.color ?? "#8a8a8a",
      }))
      .filter(
        (n) =>
          !mentions.some((m) => m.id === n.id) &&
          (!q ||
            n.label.toLowerCase().includes(q) ||
            n.kind.toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [graph.nodes, mentionQ, mentions, t]);

  const pickMention = (n: AssistantMention) => {
    setMentions((xs) => [...xs, n]);
    setDraft((t) => t.replace(/(^|\s)@[^\s]*$/, "$1"));
    setMentionOpen(false);
    setMentionQ("");
    inputRef.current?.focus();
  };

  const onDraft = (value: string) => {
    setDraft(value);
    const at = value.match(/(^|\s)@([^\s]*)$/);
    if (at) {
      setMentionOpen(true);
      setMentionQ(at[2] ?? "");
    } else {
      setMentionOpen(false);
      setMentionQ("");
    }
  };

  const send = async (override?: string) => {
    const text = (override ?? draft).trim();
    if (!text && !mentions.length) return;
    if (busy) return;
    const user: ChatRow = {
      id: `u${Date.now().toString(36)}`,
      role: "user",
      content: text || t("editor.assistant.updateMentioned"),
      mentions: mentions.length ? mentions : undefined,
    };
    const nextRows = [...rows, user];
    setRows(nextRows);
    setDraft("");
    setMentions([]);
    setMentionOpen(false);
    setBusy(true);

    const assistantId = `a${Date.now().toString(36)}`;
    setRows((xs) => [
      ...xs,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: nextRows.map(({ role, content, mentions: m }) => ({
            role,
            content,
            mentions: m,
          })),
          graph,
          graphId,
          selectedNodeIds,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err.slice(0, 180) || t("editor.assistant.failedStatus", { status: res.status }));
      }
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let reply = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let ev: { type: string; text?: string; ops?: GraphOp[]; error?: string };
          try {
            ev = JSON.parse(line);
          } catch {
            continue;
          }
          if (ev.type === "delta" && ev.text) {
            reply += ev.text;
            setRows((xs) =>
              xs.map((r) =>
                r.id === assistantId ? { ...r, content: reply } : r,
              ),
            );
          } else if (ev.type === "ops" && ev.ops?.length) {
            onApply(applyGraphOps(graph, ev.ops));
            toast(
              ev.ops.length === 1
                ? t("editor.assistant.updatedCanvas")
                : t("editor.assistant.appliedChanges", { n: num(ev.ops.length) }),
              "ok",
            );
          } else if (ev.type === "error") {
            throw new Error(ev.error || t("editor.assistant.failed"));
          }
        }
      }
      if (!reply) {
        setRows((xs) =>
          xs.map((r) =>
            r.id === assistantId
              ? { ...r, content: t("editor.assistant.doneReply") }
              : r,
          ),
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("editor.assistant.failed");
      toast(msg, "error");
      setRows((xs) =>
        xs.map((r) =>
          r.id === assistantId
            ? { ...r, content: r.content || t("editor.assistant.couldntApply", { msg }) }
            : r,
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  // A prompt carried over from the Projects page goes out once, then leaves
  // the URL so a refresh doesn't ask the assistant again.
  const autoSent = useRef(false);
  useEffect(() => {
    if (!autoPrompt || autoSent.current) return;
    autoSent.current = true;
    const url = new URL(window.location.href);
    url.searchParams.delete("prompt");
    window.history.replaceState(null, "", url.pathname + url.search);
    void send(autoPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrompt]);

  return (
    <aside
      aria-label={t("editor.assistant.title")}
      className="kun-pop z-30 flex min-h-0 w-[388px] shrink-0 flex-col border-s border-line bg-card max-md:absolute max-md:inset-x-0 max-md:bottom-0 max-md:h-[62%] max-md:w-full max-md:rounded-t-2xl max-md:border-s-0 max-md:border-t max-md:shadow-[0_-24px_48px_-24px_rgba(0,0,0,0.65)]"
    >
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink/8 text-ink">
            <Sparkle size={14} weight="fill" aria-hidden />
          </span>
          <div>
            <p className="text-[13.5px] font-medium leading-none text-ink">
              {t("editor.assistant.title")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          title={t("editor.assistant.close")}
          aria-label={t("editor.assistant.close")}
          className="flex h-8 w-8 items-center justify-center rounded-full text-faint transition-colors hover:bg-ink/8 hover:text-ink"
        >
          <X size={14} weight="bold" aria-hidden />
        </button>
      </header>

      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-auto px-4 py-4">
        {!rows.length && (
          <div className="rounded-2xl border border-dashed border-line2 px-4 py-5 text-[13px] leading-relaxed text-muted">
            <p className="font-medium text-ink">{t("editor.assistant.empty")}</p>
            <p className="mt-1">
              {t("editor.assistant.emptyBefore")}{" "}
              <kbd dir="ltr" className="rounded bg-ink/10 px-1.5 py-0.5 font-mono text-[11px] text-ink">
                @
              </kbd>{" "}
              {t("editor.assistant.emptyAfter")}
            </p>
            <div className="mt-3 flex flex-col items-start gap-1.5">
              {STARTERS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setDraft(t(k));
                    inputRef.current?.focus();
                  }}
                  className="rounded-full border border-line px-3 py-1.5 text-start text-[12.5px] text-ink transition-colors hover:border-line2 hover:bg-ink/5 active:scale-[0.98]"
                >
                  {t(k)}
                </button>
              ))}
            </div>
          </div>
        )}
        {rows.map((r) => (
          <div
            key={r.id}
            className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
              r.role === "user"
                ? "ms-auto bg-ink text-canvas"
                : "bg-sunken text-ink"
            }`}
          >
            {r.mentions?.length ? (
              <div className="mb-1.5 flex flex-wrap gap-1">
                {r.mentions.map((m) => (
                  <span
                    key={m.id}
                    className={`rounded-full px-2 py-0.5 text-[11px] ${
                      r.role === "user"
                        ? "bg-canvas/15 text-canvas"
                        : "bg-ink/10 text-muted"
                    }`}
                  >
                    @<bdi>{m.label}</bdi>
                  </span>
                ))}
              </div>
            ) : null}
            <p dir="auto" className="whitespace-pre-wrap">
              {r.content || (busy && r.role === "assistant" ? "…" : "")}
            </p>
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-line p-3">
        {mentions.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {mentions.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() =>
                  setMentions((xs) => xs.filter((x) => x.id !== m.id))
                }
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-sunken px-2.5 py-0.5 text-[11.5px] text-ink hover:border-line2"
                title={t("editor.assistant.removeMention")}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: nodeDef(m.kind)?.color ?? "var(--color-muted)" }}
                />
                @<bdi>{m.label}</bdi>
              </button>
            ))}
          </div>
        )}
        <div className="relative">
          {mentionOpen && candidates.length > 0 && (
            <div className="absolute inset-x-0 bottom-full z-10 mb-1.5 overflow-hidden rounded-xl border border-line2 bg-raised p-1 shadow-2xl shadow-black/40">
              {candidates.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => pickMention(n)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start hover:bg-ink/5"
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: n.color }}
                  />
                  <span dir="auto" className="truncate text-[12.5px] text-ink">{n.label}</span>
                  <span dir="ltr" className="ms-auto text-[11px] text-faint">{n.kind}</span>
                </button>
              ))}
            </div>
          )}
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
              if (e.key === "Escape") setMentionOpen(false);
            }}
            aria-label={t("editor.assistant.messageLabel")}
            placeholder={t("editor.assistant.placeholder")}
            dir="auto"
            rows={3}
            disabled={busy}
            className="kun-field resize-none disabled:opacity-60"
          />
        </div>
        <div className="mt-2.5 flex items-center justify-between">
          <span className="text-[12px] text-faint">{t("editor.assistant.enterToSend")}</span>
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy || (!draft.trim() && !mentions.length)}
            className="kun-btn-primary inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium disabled:opacity-40"
          >
            {busy ? t("editor.assistant.working") : t("editor.assistant.send")}
            {!busy && <PaperPlaneTilt size={13} weight="fill" className="rtl-flip" aria-hidden />}
          </button>
        </div>
      </div>
    </aside>
  );
}
