/**
 * Model catalog helpers — keeps per-node model lists organized and supports
 * the OpenRouter catalog (vendor-prefixed ids like "openai/gpt-5.2").
 */

export type ModelModality = "text" | "image" | "audio" | "video";
export type NodeModelKind = "chat" | "image" | "audio" | "video";

export interface ModelInfo {
  id: string;
  label: string;
  /** Output modalities from the provider, when known. */
  outputs?: ModelModality[];
  /** Provider-listed TTS voices. Absent means we don't know — never assume a voice. */
  voices?: string[];
}

export function kindForNode(nodeKind: string): NodeModelKind | null {
  switch (nodeKind) {
    case "llm":
      return "chat";
    case "image.gen":
      return "image";
    case "tts":
      return "audio";
    case "video.gen":
      return "video";
    default:
      return null;
  }
}

const MEDIA_HINT: Record<Exclude<NodeModelKind, "chat">, RegExp> = {
  image: /\b(image|img|flux|seedream|dall-?e|imagen|sdxl|stable-diffusion|recraft|ideogram|gpt-image)\b/i,
  video:
    /\b(video|veo|seedance|kling|runway|sora|luma|wan|hailuo|aleph|happyhorse|gen-4)\b/i,
  audio:
    /\b(tts|speech|voice|lyria|kokoro|orpheus|aura|gpt-audio|audio-mini)\b/i,
};

const NOT_TTS = /\b(whisper|transcri|asr\b|stt\b)\b/i;

export function inferOutputs(id: string, label = ""): ModelModality[] {
  const s = `${id} ${label}`;
  if (MEDIA_HINT.video.test(s) && !/\bupscale\b/i.test(s)) return ["video"];
  if (MEDIA_HINT.audio.test(s) && !NOT_TTS.test(s)) return ["audio"];
  if (MEDIA_HINT.image.test(s) && !MEDIA_HINT.video.test(s)) return ["image"];
  return ["text"];
}

export function modelFits(m: ModelInfo, kind: NodeModelKind): boolean {
  const outs =
    m.outputs && m.outputs.length ? m.outputs : inferOutputs(m.id, m.label);
  if (kind === "image") return outs.includes("image");
  if (kind === "video") return outs.includes("video");
  if (kind === "audio") return outs.includes("audio");
  return outs.includes("text");
}

export function filterModels(
  models: ModelInfo[],
  kind: NodeModelKind,
): ModelInfo[] {
  return models.filter((m) => modelFits(m, kind));
}

/** Catalog state shared between /api/models and its client cache. */
export interface ModelCatalogCore {
  models: Record<string, ModelInfo[]>;
  updatedAt: number;
  /** Providers whose last fetch failed, with a short reason. */
  errors?: Record<string, string>;
}

/**
 * Fold a fresh /api/models response into the catalog. A provider that failed
 * to fetch keeps its previous list — a network blip must not empty the
 * pickers back to the static (aging) suggestions. A successful fetch always
 * wins, even when it returns nothing (the key was removed, or the provider
 * really serves no models for that capability).
 */
export function mergeRefresh(
  prev: ModelCatalogCore,
  next: ModelCatalogCore,
): ModelCatalogCore {
  if (prev.updatedAt > next.updatedAt) return prev; // slower in-flight response
  const models = { ...next.models };
  for (const [pid, err] of Object.entries(next.errors ?? {})) {
    if (!err) continue;
    const kept = prev.models[pid];
    if (kept?.length) models[pid] = kept;
  }
  const failed = Object.entries(next.errors ?? {}).filter(([, e]) => e);
  return {
    models,
    updatedAt: next.updatedAt,
    errors: failed.length ? Object.fromEntries(failed) : undefined,
  };
}

/**
 * A provider's live list, but only when the last fetch actually succeeded —
 * an empty list from a failed fetch says nothing about what exists, so
 * availability checks must treat it as "unknown" (null), not "no models".
 */
export function liveList(
  models: Record<string, ModelInfo[]>,
  errors: Record<string, string> | undefined,
  provider = "openrouter",
): ModelInfo[] | null {
  if (errors?.[provider]) return null;
  const list = models[provider];
  return list?.length ? list : null;
}

/**
 * Default model for a new node: the first curated suggestion the provider
 * still lists; when every suggestion has been retired, any live model beats
 * an id that would 404 on run. Without live data, trust the suggestions.
 */
export function pickDefaultModel(
  suggested: { id: string }[],
  live: ModelInfo[] | null,
): string {
  if (live?.length) {
    const ids = new Set(live.map((m) => m.id));
    const hit = suggested.find((s) => ids.has(s.id));
    return hit ? hit.id : live[0].id;
  }
  return suggested[0]?.id ?? "";
}

export const PROVIDER_LABELS: Record<string, string> = {
  stealth: "Stealth",
  deepseek: "DeepSeek",
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  "meta-llama": "Meta",
  "bytedance-seed": "ByteDance Seed",
  bytedance: "ByteDance",
  minimax: "MiniMax",
  kwaivgi: "Kling",
  alibaba: "Alibaba",
  runway: "Runway",
  "x-ai": "xAI",
  "fish-audio": "Fish Audio",
  deepgram: "Deepgram",
  qwen: "Qwen",
  hexgrad: "hexgrad",
  sesame: "Sesame",
  canopylabs: "Canopy Labs",
  heygen: "HeyGen",
  "black-forest-labs": "Black Forest Labs",
};

/** Sentinel option value for the "Custom model…" entry. */
export const CUSTOM_MODEL = "__custom__";

/**
 * Vendor slug of a model id. OpenRouter prefixes alias ids with "~"
 * ("~z-ai/glm-flash-latest"), which is the same vendor as "z-ai" and must not
 * open a second group.
 */
export const providerOf = (id: string) =>
  (id.split("/")[0] ?? id).replace(/^~/, "");

export const providerLabel = (p: string) => PROVIDER_LABELS[p] ?? p;

/**
 * Providers label models "Vendor: Model" ("Z.ai: GLM Flash Latest"). Split it
 * so a group header can carry the vendor and each option only the model,
 * rather than repeating the vendor on every row.
 */
export function splitModelLabel(label: string): {
  vendor: string;
  name: string;
} {
  const i = label.indexOf(": ");
  if (i <= 0) return { vendor: "", name: label };
  return { vendor: label.slice(0, i).trim(), name: label.slice(i + 2).trim() };
}

export const modelName = (m: ModelInfo) => splitModelLabel(m.label).name || m.id;

/**
 * Bucket a flat model list into vendor groups, preserving order.
 *
 * Vendor names come from `PROVIDER_LABELS` first, then from the provider's
 * own labels, which keep up with vendors the table has never heard of. Two
 * details make the derived path messy: a slug can carry more than one name
 * ("x-ai" ships both "xAI" and "SpaceXAI"), so it takes the name most of its
 * models agree on; and one vendor can own several slugs ("meta" and
 * "meta-llama"), so buckets are keyed by the resolved name rather than the
 * slug, which would render two identical group headers.
 */
export function groupModels(models: ModelInfo[]): {
  provider: string;
  label: string;
  items: ModelInfo[];
}[] {
  const votes = new Map<string, Map<string, number>>();
  for (const m of models) {
    const vendor = splitModelLabel(m.label).vendor;
    if (!vendor) continue;
    const slug = providerOf(m.id);
    const tally = votes.get(slug) ?? new Map<string, number>();
    tally.set(vendor, (tally.get(vendor) ?? 0) + 1);
    votes.set(slug, tally);
  }
  const labelFor = (id: string) => {
    const slug = providerOf(id);
    if (PROVIDER_LABELS[slug]) return PROVIDER_LABELS[slug];
    const ranked = [...(votes.get(slug) ?? [])].sort((a, b) => b[1] - a[1]);
    return ranked[0]?.[0] ?? slug;
  };

  const order: string[] = [];
  const buckets = new Map<string, { provider: string; items: ModelInfo[] }>();
  for (const m of models) {
    const label = labelFor(m.id);
    let hit = buckets.get(label);
    if (!hit) {
      hit = { provider: providerOf(m.id), items: [] };
      buckets.set(label, hit);
      order.push(label);
    }
    hit.items.push(m);
  }
  return order.map((label) => ({ label, ...buckets.get(label)! }));
}
