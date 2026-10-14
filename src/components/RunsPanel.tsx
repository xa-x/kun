"use client";

import { useCallback, useEffect, useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { fmtCost } from "@/lib/format";
import { readJson } from "@/lib/http";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n";

/**
 * Run history for the current project, with totals (cost, tokens, duration,
 * status) that expand into per-node rows.
 */

interface RunRow {
  id: string;
  status: string;
  trigger: string;
  totalCostUsd: number; // micro-dollars
  totalTokens: number;
  durationMs: number | null;
  startedAt: string | number;
  error?: string | null;
}

interface RunNodeRow {
  id: string;
  nodeId: string;
  status: string;
  model: string | null;
  provider: string | null;
  costUsd: number;
  tokensIn: number;
  tokensOut: number;
  durationMs: number | null;
  error: string | null;
}

const TRIGGER: Record<string, MessageKey> = {
  node: "editor.runs.trigger.node",
  manual: "editor.runs.trigger.manual",
  api: "editor.runs.trigger.api",
  cron: "editor.runs.trigger.cron",
  webhook: "editor.runs.trigger.webhook",
};

export function RunsPanel({
  graphId,
  refreshKey,
}: {
  graphId: string | null;
  refreshKey: number;
}) {
  const { t, tn, ago, dur } = useI18n();
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [nodes, setNodes] = useState<Record<string, RunNodeRow[]>>({});
  const [nodeState, setNodeState] = useState<Record<string, "ok" | "err">>({});
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!graphId) return setRuns([]);
    try {
      const res = await fetch(`/api/runs?graphId=${graphId}&limit=15`);
      const j = await readJson<{ runs?: RunRow[] }>(res);
      if (!res.ok) throw new Error();
      setFailed(false);
      setRuns(Array.isArray(j?.runs) ? j.runs : []);
    } catch {
      setFailed(true);
      setRuns([]);
    }
  }, [graphId]);

  useEffect(() => {
    const t = setTimeout(() => load(), 0);
    return () => clearTimeout(t);
  }, [load, refreshKey]);

  const expand = async (runId: string) => {
    if (open === runId) return setOpen(null);
    setOpen(runId);
    if (nodes[runId] || nodeState[runId]) return;
    try {
      const res = await fetch(`/api/runs?runId=${runId}&nodes=1`);
      const j = await readJson<{ nodes?: RunNodeRow[] }>(res);
      if (!res.ok) throw new Error();
      setNodes((n) => ({
        ...n,
        [runId]: Array.isArray(j?.nodes) ? j.nodes : [],
      }));
      setNodeState((s) => ({ ...s, [runId]: "ok" }));
    } catch {
      setNodeState((s) => ({ ...s, [runId]: "err" }));
      setNodes((n) => ({ ...n, [runId]: [] }));
    }
  };

  if (!graphId)
    return (
      <p className="px-4 py-6 text-[13px] text-faint">
        {t("editor.runs.saveFirst")}
      </p>
    );

  if (failed)
    return (
      <p className="px-4 py-6 text-[13px] text-err">{t("editor.runs.loadFailed")}</p>
    );

  if (!runs.length)
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-[14px] font-medium text-ink">{t("editor.runs.none")}</p>
        <p className="mt-1 text-[13px] text-muted">
          {t("editor.runs.noneHint")}
        </p>
      </div>
    );

  return (
    <ul>
      {runs.map((r) => {
        const expanded = open === r.id;
        const tone =
          r.status === "done"
            ? "bg-ok"
            : r.status === "error" || r.status === "timed_out"
              ? "bg-err"
              : r.status === "cancelled"
                ? "bg-faint"
                : "bg-live";
        return (
          <li key={r.id} className="border-b border-line last:border-b-0">
            <button
              type="button"
              onClick={() => expand(r.id)}
              aria-expanded={expanded}
              className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-ink/[0.04]"
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${tone}`} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">
                  {TRIGGER[r.trigger] ? t(TRIGGER[r.trigger]) : r.trigger}
                </span>
                <span className="block truncate text-[12px] text-muted">
                  <bdi>{fmtCost(r.totalCostUsd)}</bdi> / <bdi>{dur(r.durationMs)}</bdi> /{" "}
                  {tn("editor.runs.tokens", r.totalTokens)}
                </span>
              </span>
              <span className="shrink-0 text-[12px] text-faint">
                {ago(r.startedAt)}
              </span>
              <CaretDown
                size={12}
                weight="bold"
                className={`shrink-0 text-faint transition-transform ${expanded ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
            {expanded && (
              <div className="border-t border-line/70 bg-sunken/50 px-4 py-3">
                {r.error && (
                  <p dir="auto" className="mb-2 text-[12px] leading-snug text-err">{r.error}</p>
                )}
                {nodeState[r.id] === "err" ? (
                  <p className="text-[12px] text-err">{t("editor.runs.nodeFailed")}</p>
                ) : (nodes[r.id] ?? []).length ? (
                  <table className="w-full text-[11.5px] text-muted">
                    <thead>
                      <tr className="text-start text-faint">
                        <th scope="col" className="pb-1.5 font-medium">
                          {t("editor.runs.node")}
                        </th>
                        <th scope="col" className="pb-1.5 text-end font-medium">
                          {t("editor.runs.cost")}
                        </th>
                        <th scope="col" className="pb-1.5 text-end font-medium">
                          {t("editor.runs.time")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="font-mono tabular-nums">
                      {(nodes[r.id] ?? []).map((n) => (
                        <tr
                          key={n.id}
                          className={
                            n.status === "error"
                              ? "text-err"
                              : n.status === "skipped"
                                ? "text-faint"
                                : ""
                          }
                        >
                          <td className="max-w-36 truncate py-0.5" title={n.model ?? ""}>
                            <bdi>{n.nodeId}</bdi>
                          </td>
                          <td className="text-end">{fmtCost(n.costUsd)}</td>
                          <td className="text-end">{dur(n.durationMs)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-[12px] text-faint">{t("common.loading")}</p>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
