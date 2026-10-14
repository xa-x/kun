import { nodeDef } from "./nodes";
import type { GraphDoc } from "./types";

export interface AppliedInputs {
  doc: GraphDoc;
  /** Names that found a node. */
  applied: string[];
  /** Names that found nothing, so the caller can say so. */
  ignored: string[];
}

/** Nodes that take a value from outside, and which field it fills. */
function fieldFor(kind: string): "text" | "prompt" | null {
  if (kind === "text" || kind === "note") return "text";
  // The text model keeps a prompt box; media nodes read their prompt from a
  // wired Text node, which is matched on its own.
  if (kind === "llm") return "prompt";
  return null;
}

/**
 * Fill a project's inputs for one run. `values` is keyed by a node's id or its
 * name (label), case-insensitively, and a Text or Instruction node takes the
 * value as its text. A value that is not a string is sent as JSON.
 *
 * This is how a webhook body, a schedule's saved inputs or an API call's
 * `input` reach the project: the project itself is not changed, only the copy
 * that runs.
 */
export function applyRunInputs(
  doc: GraphDoc,
  values: Record<string, unknown> | null | undefined,
): AppliedInputs {
  const entries = Object.entries(values ?? {});
  if (!entries.length) return { doc, applied: [], ignored: [] };

  const applied: string[] = [];
  const ignored: string[] = [];
  const nodes = doc.nodes.map((n) => ({ ...n, data: { ...n.data } }));

  for (const [name, raw] of entries) {
    const key = name.trim().toLowerCase();
    const hits = nodes.filter(
      (n) =>
        fieldFor(n.data.kind) &&
        (n.id.toLowerCase() === key ||
          (n.data.label ?? nodeDef(n.data.kind)?.label ?? "").trim().toLowerCase() === key),
    );
    if (!hits.length) {
      ignored.push(name);
      continue;
    }
    const value = typeof raw === "string" ? raw : JSON.stringify(raw);
    for (const n of hits) {
      const f = fieldFor(n.data.kind)!;
      n.data[f] = value;
    }
    applied.push(name);
  }
  return { doc: { ...doc, nodes }, applied, ignored };
}

/** Names a caller can use: the Text and Instruction nodes, by label. */
export function inputNames(doc: Pick<GraphDoc, "nodes">): string[] {
  const seen = new Set<string>();
  for (const n of doc.nodes) {
    if (n.data.kind !== "text" && n.data.kind !== "note") continue;
    seen.add((n.data.label ?? nodeDef(n.data.kind)?.label ?? n.id).trim());
  }
  return [...seen];
}
