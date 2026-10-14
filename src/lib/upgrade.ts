import type { GraphDoc } from "./types";

const UPLOAD_KINDS = {
  "image.in": "image",
  "audio.in": "audio",
  "video.in": "video",
} as const;
const DEFAULT_UPLOAD_LABELS = new Set(["Image", "Audio", "Video"]);
const OUTPUT_KINDS = new Set(["out.text", "out.media"]);

type Node = GraphDoc["nodes"][number];
type Edge = GraphDoc["edges"][number];

/**
 * Rewrite saved graphs to the current node set, so old projects open
 * simplified. Pure and idempotent: a graph that is already current comes back
 * as the same object.
 *
 * - Output (`out.text`, and the older Media Out `out.media`) is removed: every
 *   node shows its own result now. Whatever was wired into it is pinned
 *   ("Return"), which keeps it the project's result, and wires that left the
 *   Output are rejoined from those same nodes.
 * - Image, Audio and Video upload nodes become one File node (`file.in`) with
 *   a single `out` handle. It keeps the media type of the node it replaces.
 * - Skill (`skill`) becomes an Instruction node (`note`). It already held the
 *   skill's instructions as text; the skill id stays so an empty body still
 *   resolves to the skill.
 * - A skill set on an AI node becomes an Instruction node wired into that
 *   node's text input, so the skill is a visible step on the canvas instead of
 *   a hidden setting on the node. The same goes for a prompt typed into an
 *   image, video or speech node: it becomes a Text node ("Prompt").
 */
export function upgradeGraph(doc: GraphDoc): GraphDoc {
  const withoutOutputs = dropOutputs(doc);
  if (withoutOutputs !== doc) return upgradeGraph(withoutOutputs);
  const kindOf = new Map(doc.nodes.map((n) => [n.id, n.data.kind]));

  let changed = false;
  const nodes = doc.nodes.map((n): Node => {
    const next = upgradeNode(n);
    if (next !== n) changed = true;
    return next;
  });

  const edges = doc.edges.map((e): Edge => {
    const src = kindOf.get(e.source) ?? "";
    let next = e;
    if ((src === "file.in" || src in UPLOAD_KINDS) && e.sourceHandle !== "out")
      next = { ...next, sourceHandle: "out" };
    if (next !== e) changed = true;
    return next;
  });

  // What an AI node used to hold inside itself moves out to nodes of its own:
  // a skill becomes an Instruction, and the prompt typed into an image, video
  // or speech node becomes a Text node. Both are wired into the node's text
  // input, so they are visible steps on the canvas instead of hidden settings.
  const extraNodes: Node[] = [];
  const extraEdges: Edge[] = [];
  const present = new Set(nodes.map((n) => n.id));
  const moved = nodes.map((n): Node => {
    const handle = SKILL_INPUT[n.data.kind];
    if (!handle) return n;
    const skill = n.data.skillId;
    const prompt =
      n.data.kind !== "llm" && typeof n.data.prompt === "string" && n.data.prompt.trim()
        ? n.data.prompt
        : undefined;
    if (!skill && !prompt) return n;
    const add = (suffix: string, y: number, data: Node["data"]) => {
      const id = `${n.id}-${suffix}`;
      if (present.has(id)) return;
      present.add(id);
      extraNodes.push({
        id,
        type: n.type,
        position: { x: n.position.x - 340, y },
        data,
      });
      extraEdges.push({
        id: `e-${id}`,
        source: id,
        sourceHandle: "out",
        target: n.id,
        targetHandle: handle,
      });
    };
    changed = true;
    if (skill)
      add("skill", n.position.y - (prompt ? 190 : 20), {
        kind: "note",
        label: "Instruction",
        skillId: skill,
      });
    if (prompt)
      add("prompt", n.position.y - 20, { kind: "text", label: "Prompt", text: prompt });
    const rest = { ...n.data };
    delete rest.skillId;
    if (prompt) delete rest.prompt;
    return { ...n, data: rest };
  });

  return changed
    ? { ...doc, nodes: [...extraNodes, ...moved], edges: [...edges, ...extraEdges] }
    : doc;
}

/** Where each AI node reads text from. */
const SKILL_INPUT: Record<string, string> = {
  llm: "in",
  "image.gen": "prompt",
  "video.gen": "prompt",
  tts: "text",
};

/**
 * Remove Output nodes. Their sources become pinned, and anything the Output
 * fed is fed by those sources directly (each takes the wire's own port, so the
 * old per-type filtering still applies on the receiving side).
 */
function dropOutputs(doc: GraphDoc): GraphDoc {
  const outs = doc.nodes.filter((n) => OUTPUT_KINDS.has(n.data.kind));
  if (!outs.length) return doc;
  const gone = new Set(outs.map((n) => n.id));
  const pinned = new Set<string>();
  const joined: Edge[] = [];
  for (const o of outs) {
    const feeders = doc.edges.filter((e) => e.target === o.id && !gone.has(e.source));
    const leaving = doc.edges.filter((e) => e.source === o.id && !gone.has(e.target));
    for (const f of feeders) pinned.add(f.source);
    for (const f of feeders)
      for (const l of leaving)
        joined.push({
          id: `e-${f.source}-${l.target}-${l.targetHandle ?? "in"}`,
          source: f.source,
          sourceHandle: f.sourceHandle,
          target: l.target,
          targetHandle: l.targetHandle,
        });
  }
  return {
    ...doc,
    nodes: doc.nodes
      .filter((n) => !gone.has(n.id))
      .map((n) => (pinned.has(n.id) ? { ...n, data: { ...n.data, pinned: true } } : n)),
    edges: [
      ...doc.edges.filter((e) => !gone.has(e.source) && !gone.has(e.target)),
      ...joined,
    ],
  };
}

function upgradeNode(n: Node): Node {
  const { kind, label } = n.data;
  if (kind in UPLOAD_KINDS) {
    return {
      ...n,
      data: {
        ...n.data,
        kind: "file.in",
        mediaType: UPLOAD_KINDS[kind as keyof typeof UPLOAD_KINDS],
        label: DEFAULT_UPLOAD_LABELS.has(label ?? "") ? "File" : label,
      },
    };
  }
  if (kind === "skill") {
    return {
      ...n,
      data: {
        ...n.data,
        kind: "note",
        label: label === "Skill" ? "Instruction" : label,
      },
    };
  }
  return n;
}
