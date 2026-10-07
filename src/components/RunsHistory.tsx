"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CaretDown, Lightning } from "@phosphor-icons/react";
import { ago, fmtCost, fmtDur } from "@/lib/format";
import { toast } from "./Toast";
import { readJson } from "@/lib/http";
import { APP_HOME } from "@/lib/routes";
import { PageHeader } from "./shell/PageHeader";

interface RunRow {
  id: string;
  graphId: string;
  graphTitle?: string | null;
  status: string;
  trigger: string;
  totalCostUsd: number;
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

interface BookOpt {
  id: string;
  title: string;
}

const TRIGGER_LABEL: Record<string, string> = {
  node: "Single node",
  manual: "Full run",
  api: "API",
  cron: "Schedule",
  webhook: "Webhook",
};

function RunStatus({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    done: { label: "Done", cls: "bg-ok/12 text-ok" },
    error: { label: "Failed", cls: "bg-err/12 text-err" },
    timed_out: { label: "Timed out", cls: "bg-err/12 text-err" },
    cancelled: { label: "Cancelled", cls: "bg-ink/8 text-muted" },
    running: { label: "Running", cls: "bg-live/12 text-live" },
    queued: { label: "Queued", cls: "bg-live/12 text-live" },
  };
  const s = map[status] ?? { label: status, cls: "bg-ink/8 text-muted" };
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[11.5px] font-medium ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

export function RunsHistory() {
  const params = useSearchParams();
  const initial = params.get("graphId") ?? "";
  const [filter, setFilter] = useState(initial);
  const [books, setBooks] = useState<BookOpt[]>([]);
  const [runs, setRuns] = useState<RunRow[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [nodes, setNodes] = useState<Record<string, RunNodeRow[]>>({});
  const [nodeState, setNodeState] = useState<Record<string, "ok" | "err">>({});

  useEffect(() => {
    fetch("/api/graphs")
      .then((r) => readJson<{ graphs?: BookOpt[] }>(r))
      .then((j) => setBooks(Array.isArray(j?.graphs) ? j.graphs : []))
      .catch(() => setBooks([]));
  }, []);

  const load = useCallback(async () => {
    setRuns(null);
    try {
      const q = filter
        ? `?graphId=${encodeURIComponent(filter)}&limit=50`
        : "?limit=50";
      const res = await fetch(`/api/runs${q}`);
      const j = await readJson<{ runs?: RunRow[]; error?: string }>(res);
      if (!res.ok) throw new Error(j.error || "Failed to load runs");
      setRuns(Array.isArray(j?.runs) ? j.runs : []);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn’t load runs.", "error");
      setRuns([]);
    }
  }, [filter]);

  useEffect(() => {
    const t = setTimeout(() => load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const expand = async (runId: string) => {
    if (open === runId) return setOpen(null);
    setOpen(runId);
    if (nodes[runId] || nodeState[runId] === "err") return;
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

  const labelFor = useMemo(() => {
    const m = new Map(books.map((b) => [b.id, b.title]));
    return (r: RunRow) => r.graphTitle || m.get(r.graphId) || "Untitled";
  }, [books]);

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 md:px-10 md:py-12">
      <PageHeader
        title="Runs"
        description="Cost, tokens and duration for every execution, whether you pressed Run or a schedule did."
        actions={
          <label className="flex items-center gap-3">
            <span className="text-[13px] text-muted">Workbook</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="kun-input !h-10 !w-auto min-w-48 !rounded-full !py-0"
            >
              <option value="">All workbooks</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title || "Untitled"}
                </option>
              ))}
            </select>
          </label>
        }
      />

      {runs === null && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="kun-skeleton h-[68px]" />
          ))}
        </div>
      )}

      {runs && runs.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line2 bg-card/30 px-6 py-16 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-ink/8 text-ink">
            <Lightning size={20} weight="bold" aria-hidden />
          </span>
          <p className="mt-4 text-[16px] font-medium text-ink">No runs yet</p>
          <p className="mx-auto mt-1 max-w-sm text-[13.5px] leading-relaxed text-muted">
            Run a workbook from the canvas and its history, with a per-node cost
            breakdown, will collect here.
          </p>
          <Link
            href={APP_HOME}
            className="kun-btn-secondary mt-6 inline-flex h-10 items-center rounded-full px-5 text-[13px] font-medium"
          >
            Open a workbook
          </Link>
        </div>
      )}

      {runs && runs.length > 0 && (
        <ul className="overflow-hidden rounded-2xl border border-line bg-card/70">
          {runs.map((r) => {
            const expanded = open === r.id;
            return (
              <li key={r.id} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  onClick={() => expand(r.id)}
                  aria-expanded={expanded}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-ink/[0.03]"
                >
                  <RunStatus status={r.status} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium text-ink">
                      {labelFor(r)}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-[12.5px] text-muted">
                      <span>{TRIGGER_LABEL[r.trigger] ?? r.trigger}</span>
                      <span>{r.totalTokens.toLocaleString()} tokens</span>
                      <span>{fmtCost(r.totalCostUsd)}</span>
                      <span>{fmtDur(r.durationMs)}</span>
                    </div>
                  </div>
                  <span className="hidden shrink-0 text-[12.5px] text-faint sm:block">
                    {ago(r.startedAt)}
                  </span>
                  <CaretDown
                    size={14}
                    weight="bold"
                    className={`shrink-0 text-faint transition-transform ${expanded ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>

                {expanded && (
                  <div className="border-t border-line/70 bg-sunken/50 px-5 py-4">
                    <div className="mb-3 flex items-center justify-between gap-4">
                      {r.error ? (
                        <p className="text-[13px] leading-snug text-err">
                          {r.error}
                        </p>
                      ) : (
                        <span />
                      )}
                      <Link
                        href={`/w/${r.graphId}`}
                        className="shrink-0 text-[13px] font-medium text-ink underline-offset-4 hover:underline"
                      >
                        Open workbook
                      </Link>
                    </div>
                    {nodeState[r.id] === "err" ? (
                      <p className="text-[13px] text-err">
                        Couldn’t load the node breakdown.
                      </p>
                    ) : !(nodes[r.id] ?? []).length && nodeState[r.id] !== "ok" ? (
                      <p className="text-[13px] text-faint">Loading…</p>
                    ) : (nodes[r.id] ?? []).length ? (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[480px] text-[12.5px] text-muted">
                          <thead>
                            <tr className="text-left text-faint">
                              <th scope="col" className="pb-2 font-medium">
                                Node
                              </th>
                              <th scope="col" className="pb-2 text-right font-medium">
                                Tokens
                              </th>
                              <th scope="col" className="pb-2 text-right font-medium">
                                Cost
                              </th>
                              <th scope="col" className="pb-2 text-right font-medium">
                                Time
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
                                <td
                                  className="max-w-64 truncate py-1"
                                  title={n.model ?? ""}
                                >
                                  {n.nodeId}
                                  {n.model ? ` (${n.model})` : ""}
                                </td>
                                <td className="text-right">
                                  {n.tokensIn + n.tokensOut > 0
                                    ? (n.tokensIn + n.tokensOut).toLocaleString()
                                    : "—"}
                                </td>
                                <td className="text-right">{fmtCost(n.costUsd)}</td>
                                <td className="text-right">{fmtDur(n.durationMs)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-[13px] text-faint">No node rows.</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
