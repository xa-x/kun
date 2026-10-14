import { isRunnableKind } from "./nodes";
import type { GraphDoc } from "./types";

/** A project's published version: the saved graph, stamped with when. */
export type PublishedDoc = GraphDoc & { publishedAt?: string };

export function publishDoc(graph: GraphDoc): PublishedDoc {
  return { ...graph, publishedAt: new Date().toISOString() };
}

// What a node holds only while a page is open or a run is going, plus what only
// changes how it looks. None of it changes what a run does.
const NOT_BEHAVIOUR = new Set([
  "outputs",
  "runStatus",
  "runError",
  "runUsage",
  "runStartedAt",
  "runDurationMs",
  "streamingText",
  "selected",
  "status",
  "error",
  "label",
  "tone",
  "group",
  "w",
  "h",
]);

/** The parts of a graph that decide what a run does, in a stable order. */
function behaviour(doc: Partial<GraphDoc> | null | undefined) {
  const nodes = (doc?.nodes ?? [])
    .filter((n) => isRunnableKind(n.data.kind))
    .map((n) => ({
      id: n.id,
      data: Object.fromEntries(
        Object.entries(n.data)
          .filter(([k, v]) => !NOT_BEHAVIOUR.has(k) && v !== undefined)
          .sort(([a], [b]) => a.localeCompare(b)),
      ),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const edges = (doc?.edges ?? [])
    .map((e) => [e.source, e.sourceHandle ?? "", e.target, e.targetHandle ?? ""].join("|"))
    .sort();
  return JSON.stringify({ nodes, edges });
}

/**
 * Has the project changed in a way that matters since it was published? Moving
 * nodes, renaming them, new run results and comments do not count.
 */
export function hasUnpublishedChanges(
  live: GraphDoc | null | undefined,
  published: PublishedDoc | null | undefined,
): boolean {
  if (!published) return true;
  return behaviour(live) !== behaviour(published);
}
