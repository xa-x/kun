import { downstreamIds, hasOutputNode, inertNodeIds } from "./graph";
import { nodeDef } from "./nodes";
import type { MessageKey } from "./i18n/messages";
import type { Vars } from "./i18n/translate";

type T = (key: MessageKey, vars?: Vars) => string;

/** A run costing at least this asks for a yes first. */
export const CONFIRM_COST_USD = 0.25;

/** Which part of a project a run covers. */
export interface RunScope {
  /** Only this node, reading its inputs from earlier results. */
  only?: string;
  /** This node and everything after it. */
  from?: string;
  /** Exactly these nodes, e.g. a group run apart from the rest. */
  nodes?: string[];
}

interface N {
  id: string;
  data: { kind: string; frozen?: boolean };
}
interface E {
  source: string;
  target: string;
}

/** The nodes a run of `scope` will actually execute. */
export function runTargets(nodes: N[], edges: E[], scope: RunScope = {}): string[] {
  if (scope.only) return [scope.only];
  if (scope.nodes?.length) return scope.nodes;
  if (scope.from) return downstreamIds(scope.from, edges);
  // A full run runs every node. Only graphs that still hold an Output node
  // skip generation nothing leads into (the server does the same).
  const inert = hasOutputNode(nodes) ? inertNodeIds(nodes, edges) : new Set<string>();
  return nodes.filter((n) => !inert.has(n.id)).map((n) => n.id);
}

export interface RunEstimate {
  costUsd: number;
  /** Wall time: the longest chain of steps, since independent ones run together. */
  durationMs: number;
  /** AI nodes that will run. */
  aiNodes: number;
  /** AI nodes with no history yet, so left out of the figures. */
  unpriced: number;
}

export function estimateRun(opts: {
  nodes: N[];
  edges: E[];
  scope?: RunScope;
  /** Typical cost and time for one node, or null if never run. */
  estimateOf: (nodeId: string) => { costUsd: number; durationMs: number } | null;
}): RunEstimate {
  const { nodes, edges, scope } = opts;
  const targets = new Set(runTargets(nodes, edges, scope));
  // Frozen nodes are not run, so they cost nothing and take no time (unless
  // one is asked for by itself).
  const ai = nodes.filter(
    (n) =>
      targets.has(n.id) &&
      nodeDef(n.data.kind)?.category === "ai" &&
      (!n.data.frozen || scope?.only === n.id),
  );

  let costUsd = 0;
  let unpriced = 0;
  const dur = new Map<string, number>();
  for (const n of ai) {
    const e = opts.estimateOf(n.id);
    if (!e) unpriced++;
    else {
      costUsd += e.costUsd;
      dur.set(n.id, e.durationMs);
    }
  }

  // Longest path through the targets, summing each node's own time.
  const memo = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  for (const e of edges) {
    if (!targets.has(e.source) || !targets.has(e.target)) continue;
    (outgoing.get(e.source) ?? outgoing.set(e.source, []).get(e.source)!).push(e.target);
  }
  const longest = (id: string, seen: Set<string>): number => {
    if (memo.has(id)) return memo.get(id)!;
    if (seen.has(id)) return 0; // a cycle never finishes anyway
    seen.add(id);
    let best = 0;
    for (const next of outgoing.get(id) ?? []) best = Math.max(best, longest(next, seen));
    seen.delete(id);
    const total = (dur.get(id) ?? 0) + best;
    memo.set(id, total);
    return total;
  };
  let durationMs = 0;
  for (const id of targets) durationMs = Math.max(durationMs, longest(id, new Set()));

  return { costUsd, durationMs, aiNodes: ai.length, unpriced };
}

/**
 * "~$0.94 · ~6 min", with a note when some steps have no history. Pass the
 * translator from `useI18n()` to word it in the active language.
 */
export function formatRunEstimate(e: RunEstimate, t?: T): string | null {
  if (!e.aiNodes) return null;
  if (e.unpriced === e.aiNodes) return null;
  const cost = e.costUsd >= 0.01 ? `$${e.costUsd.toFixed(2)}` : `$${e.costUsd.toFixed(4)}`;
  const s = e.durationMs / 1000;
  let time = "";
  if (s) {
    if (s < 90) {
      const n = Math.max(1, Math.round(s));
      time = t ? t("editor.estimate.sec", { n }) : `${n}s`;
    } else {
      const n = Math.round(s / 60);
      time = t ? t("editor.estimate.min", { n }) : `${n} min`;
    }
  }
  const base = time ? `~${cost} · ~${time}` : `~${cost}`;
  if (!e.unpriced) return base;
  return `${base} ${t ? t("editor.estimate.unpriced", { n: e.unpriced }) : `+ ${e.unpriced} unpriced`}`;
}
