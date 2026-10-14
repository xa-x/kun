/**
 * Node type registry — the contract between canvas, engine, and runners.
 * A node type declares its input/output ports (typed), and the engine
 * routes upstream outputs into a node's inputs before running it.
 */

/**
 * "any" is a port that takes or gives every kind of result, any number of
 * times: Output and File use it so a node needs one input and one output
 * instead of a row of typed ones.
 */
export type PortType = "text" | "image" | "audio" | "video" | "json" | "any";

export interface PortDef {
  id: string;
  label: string;
  type: PortType;
}

export interface NodeTypeDef {
  type: string;
  label: string;
  description: string;
  /** "note" nodes (comments, groups) annotate the canvas and never run. */
  category: "input" | "ai" | "output" | "note";
  /**
   * Retired type kept only so old graphs still run. Hidden from menus and the
   * assistant; `upgradeGraph` rewrites it to its replacement when a project
   * opens.
   */
  legacy?: boolean;
  /** CSS colour (a design-token var) tinting the node by the data it outputs. */
  color: string;
  inputs: PortDef[];
  outputs: PortDef[];
  /** Model selector choices offered in the node UI. */
  models?: { id: string; label: string }[];
}

export const NODE_TYPES: NodeTypeDef[] = [
  {
    type: "comment",
    label: "Comment",
    description: "A note on the canvas. It never runs.",
    category: "note",
    color: "var(--color-warn)",
    inputs: [],
    outputs: [],
  },
  {
    type: "group",
    label: "Group",
    description: "Frame some nodes together so they can be run on their own.",
    category: "note",
    color: "var(--color-muted)",
    inputs: [],
    outputs: [],
  },
  {
    type: "text",
    label: "Text",
    description: "Raw text or paste an article",
    category: "input",
    color: "var(--color-t-text)",
    inputs: [],
    outputs: [{ id: "out", label: "Text", type: "text" }],
  },
  {
    type: "note",
    label: "Instruction",
    description: "A standing instruction or a skill. Wire it into an AI node's prompt.",
    category: "input",
    color: "var(--color-t-text)",
    inputs: [],
    outputs: [{ id: "out", label: "Text", type: "text" }],
  },
  {
    type: "skill",
    label: "Skill",
    description:
      "Retired: pick a skill on the AI node instead. Old graphs still run.",
    legacy: true,
    category: "input",
    color: "var(--color-t-text)",
    inputs: [],
    outputs: [{ id: "out", label: "Text", type: "text" }],
  },
  {
    type: "file.in",
    label: "File",
    description: "Upload an image, audio or video file",
    category: "input",
    color: "var(--color-t-image)",
    inputs: [],
    outputs: [{ id: "out", label: "File", type: "any" }],
  },
  {
    type: "image.in",
    legacy: true,
    label: "Image",
    description: "Upload an image",
    category: "input",
    color: "var(--color-t-image)",
    inputs: [],
    outputs: [{ id: "out", label: "Image", type: "image" }],
  },
  {
    type: "audio.in",
    legacy: true,
    label: "Audio",
    description: "Upload an audio file",
    category: "input",
    inputs: [],
    outputs: [{ id: "out", label: "Audio", type: "audio" }],
    color: "var(--color-t-audio)",
  },
  {
    type: "video.in",
    legacy: true,
    label: "Video",
    description: "Upload a video file",
    category: "input",
    inputs: [],
    outputs: [{ id: "out", label: "Video", type: "video" }],
    color: "var(--color-t-video)",
  },
  {
    type: "llm",
    label: "AI Text",
    description: "Chat model: summarize, rewrite, translate…",
    category: "ai",
    color: "var(--color-t-text)",
    inputs: [
      { id: "in", label: "Context", type: "text" },
      { id: "image", label: "Image", type: "image" }, // vision
    ],
    outputs: [{ id: "out", label: "Text", type: "text" }],
    models: [
      { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { id: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5" },
      { id: "openai/gpt-5.2", label: "GPT-5.2" },
      { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { id: "meta-llama/llama-4-maverick", label: "Llama 4 Maverick" },
    ],
  },
  {
    type: "image.gen",
    label: "AI Image",
    description:
      "Generate or edit an image. Connect a reference to keep the subject and change the background. Size and aspect are optional — Auto uses the model default.",
    category: "ai",
    color: "var(--color-t-image)",
    inputs: [
      { id: "prompt", label: "Prompt", type: "text" },
      { id: "image", label: "Reference", type: "image" },
    ],
    outputs: [{ id: "out", label: "Image", type: "image" }],
    models: [
      { id: "bytedance-seed/seedream-5-0-lite", label: "Seedream 5 Lite" },
      { id: "black-forest-labs/flux.2-klein-4b", label: "FLUX.2 Klein" },
      { id: "bytedance-seed/seedream-5-0-pro", label: "Seedream 5 Pro" },
      { id: "google/gemini-3.0-pro-image-preview", label: "Gemini Image" },
    ],
  },
  {
    type: "tts",
    label: "AI Speech",
    description:
      "Text to speech. Voice is optional — Auto uses the model default; listed voices come from the model when known.",
    category: "ai",
    color: "var(--color-t-audio)",
    inputs: [{ id: "text", label: "Text", type: "text" }],
    outputs: [{ id: "out", label: "Audio", type: "audio" }],
    models: [
      { id: "minimax/speech-2.8-turbo", label: "MiniMax Speech 2.8 Turbo" },
      { id: "google/gemini-3.1-flash-tts-preview", label: "Gemini 3.1 Flash TTS" },
      { id: "minimax/speech-2.8-hd", label: "MiniMax Speech 2.8 HD" },
      { id: "x-ai/grok-voice-tts-1.0", label: "Grok Voice TTS" },
    ],
  },
  {
    type: "video.gen",
    label: "AI Video",
    description:
      "Text/image to video. Duration, aspect, and resolution are optional — Auto uses the model default.",
    category: "ai",
    color: "var(--color-t-video)",
    inputs: [
      { id: "prompt", label: "Prompt", type: "text" },
      { id: "image", label: "First frame", type: "image" },
    ],
    outputs: [{ id: "out", label: "Video", type: "video" }],
    models: [
      { id: "bytedance/seedance-2.5", label: "Seedance 2.5" },
      { id: "google/veo-3.1", label: "Veo 3.1" },
      { id: "openai/sora-2-pro", label: "Sora 2 Pro" },
      { id: "kwaivgi/kling-v3.0-pro", label: "Kling v3.0 Pro" },
    ],
  },
  {
    // Retired: every node shows its own result now, and the project's result
    // is the pinned or last nodes. Saved graphs and scheduled runs that still
    // hold one keep working; opening a project removes it.
    type: "out.text",
    label: "Output",
    legacy: true,
    description:
      "Retired. Every node shows its own result; pin a node to return it.",
    category: "output",
    color: "var(--color-t-text)",
    inputs: [{ id: "in", label: "Result", type: "any" }],
    outputs: [{ id: "out", label: "Result", type: "any" }],
  },
  {
    type: "out.media",
    label: "Media Out",
    description: "Retired: use Output. Old graphs still run.",
    legacy: true,
    category: "output",
    inputs: [
      { id: "in", label: "Media", type: "image" },
      { id: "audio", label: "Audio", type: "audio" },
      { id: "video", label: "Video", type: "video" },
    ],
    outputs: [
      { id: "image", label: "Image", type: "image" },
      { id: "audio", label: "Audio", type: "audio" },
      { id: "video", label: "Video", type: "video" },
    ],
    color: "var(--color-muted)",
  },
];

/** Node types offered for new nodes: everything that is not retired. */
export const visibleNodeTypes = NODE_TYPES.filter((d) => !d.legacy);

/**
 * Nodes that could sit on the other end of a port. From an output of `type`
 * these are the nodes with an input that takes it; from an input, the nodes
 * with an output that fits. Notes, retired kinds and nodes with nothing to
 * connect are left out.
 */
export function compatibleKinds(type: PortType, side: "out" | "in"): NodeTypeDef[] {
  return visibleNodeTypes.filter((d) => {
    if (d.category === "note") return false;
    return side === "out"
      ? d.inputs.some((p) => portAccepts(p.type, type))
      : d.outputs.some((p) => portAccepts(type, p.type));
  });
}

/** Does this kind take part in a run? Comments and groups only annotate. */
export const isRunnableKind = (kind: string) =>
  (nodeDef(kind)?.category ?? "input") !== "note";

/** Retired kinds mapped to what replaces them, for the assistant and imports. */
const KIND_ALIASES: Record<string, string> = {
  "out.media": "out.text",
  skill: "note",
  "image.in": "file.in",
  "audio.in": "file.in",
  "video.in": "file.in",
};
export const canonicalKind = (kind: string) => KIND_ALIASES[kind] ?? kind;

export const nodeDef = (t: string) => NODE_TYPES.find((d) => d.type === t);
export const portDef = (t: string, portId: string, dir: "in" | "out") =>
  (dir === "in" ? nodeDef(t)?.inputs : nodeDef(t)?.outputs)?.find(
    (p) => p.id === portId,
  );

/** Image accepts image; media sinks accept anything binary-ish. */
export function portAccepts(sink: PortType, source: PortType): boolean {
  if (sink === source || sink === "any" || source === "any") return true;
  return false;
}

/**
 * Which input an "any" output should feed when nobody named one. A File holds
 * media, so it prefers a media input; other nodes carry mostly text.
 */
function pickForAny(srcKind: string, tgtPorts: PortDef[]): PortDef | undefined {
  const order: PortType[] =
    srcKind === "file.in"
      ? ["image", "audio", "video", "any", "text"]
      : ["text", "any", "image", "audio", "video"];
  for (const type of order) {
    const hit = tgtPorts.find((p) => p.type === type);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Pick compatible source/target handles. Wrong or missing handle ids
 * (the assistant often emits "in"/"out") are remapped to a typed pair.
 */
export function matchPorts(
  srcKind: string,
  tgtKind: string,
  sourceHandle?: string | null,
  targetHandle?: string | null,
): { sourceHandle: string; targetHandle: string } | null {
  const sDef = nodeDef(srcKind);
  const tDef = nodeDef(tgtKind);
  if (!sDef?.outputs.length || !tDef?.inputs.length) return null;
  const srcPorts = sDef.outputs;
  const tgtPorts = tDef.inputs;
  const namedSrc = sourceHandle
    ? srcPorts.find((p) => p.id === sourceHandle)
    : undefined;
  const namedTgt = targetHandle
    ? tgtPorts.find((p) => p.id === targetHandle)
    : undefined;
  if (namedSrc && namedTgt && portAccepts(namedTgt.type, namedSrc.type)) {
    return { sourceHandle: namedSrc.id, targetHandle: namedTgt.id };
  }
  if (namedSrc) {
    const t =
      namedSrc.type === "any"
        ? pickForAny(srcKind, tgtPorts)
        : tgtPorts.find((p) => portAccepts(p.type, namedSrc.type));
    if (t) return { sourceHandle: namedSrc.id, targetHandle: t.id };
  }
  if (namedTgt) {
    const s = srcPorts.find((p) => portAccepts(namedTgt.type, p.type));
    if (s) return { sourceHandle: s.id, targetHandle: namedTgt.id };
  }
  for (const s of srcPorts) {
    const t =
      s.type === "any"
        ? pickForAny(srcKind, tgtPorts)
        : tgtPorts.find((p) => portAccepts(p.type, s.type));
    if (t) return { sourceHandle: s.id, targetHandle: t.id };
  }
  return null;
}
