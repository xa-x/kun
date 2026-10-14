import { nodeDef } from "../nodes";
import type { GraphDoc, NodeOutput } from "../types";

export interface RunResultItem {
  nodeId: string;
  label: string;
  outputs: NodeOutput[];
}

interface NodeRow {
  nodeId: string;
  status: string;
  output: unknown;
}

const usable = (outputs: NodeOutput[]) =>
  outputs.filter((o) => (o.type === "text" ? !!o.text?.trim() : !!o.url));

/**
 * A run's result: what the project hands back to an API, webhook or schedule.
 *
 * Every node shows its own result on the canvas, so the result is picked by
 * rule rather than by a node you place:
 * - nodes pinned with "Return", if any are pinned; otherwise
 * - the last nodes: AI nodes that nothing is wired out of.
 * Projects saved with an Output node keep that meaning: its nodes are the
 * result.
 *
 * Nodes that did not finish, or made nothing, are left out. Order is the order
 * on the canvas snapshot.
 */
export function runResult(
  snapshot: Pick<GraphDoc, "nodes" | "edges"> | null | undefined,
  rows: NodeRow[],
): RunResultItem[] {
  const nodes = snapshot?.nodes ?? [];
  const edges = snapshot?.edges ?? [];
  const byNode = new Map(rows.map((r) => [r.nodeId, r]));
  const hasOutputs = nodes.some((n) => n.data.kind.startsWith("out."));
  const pinned = nodes.some((n) => n.data.pinned);
  const feeding = new Set(edges.map((e) => e.source));

  const picks = nodes.filter((n) => {
    if (hasOutputs) return n.data.kind.startsWith("out.");
    if (pinned) return !!n.data.pinned;
    return nodeDef(n.data.kind)?.category === "ai" && !feeding.has(n.id);
  });

  const items: RunResultItem[] = [];
  for (const n of picks) {
    const row = byNode.get(n.id);
    // A frozen node did not run this time; what it holds still counts.
    const out = row?.status === "done" ? row.output : n.data.frozen ? n.data.outputs : null;
    if (!Array.isArray(out)) continue;
    const outputs = usable(out as NodeOutput[]);
    if (!outputs.length) continue;
    items.push({
      nodeId: n.id,
      label: n.data.label || nodeDef(n.data.kind)?.label || "Result",
      outputs,
    });
  }
  return items;
}
