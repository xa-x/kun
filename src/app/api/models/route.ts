import { NextRequest, NextResponse } from "next/server";
import { providerCreds } from "@/lib/providers";
import { enabledModels, policyMap } from "@/lib/model-policy";
import { recentModelUsage } from "@/lib/model-usage";
import { buildSuggestions } from "@/lib/model-suggestions";
import { nodeDef } from "@/lib/nodes";
import {
  inferOutputs,
  type ModelInfo,
  type ModelModality,
  type NodeModelKind,
} from "@/lib/models";

export const runtime = "nodejs";

const MODALITIES = new Set<ModelModality>(["text", "image", "audio", "video"]);

/** OpenRouter tags text-to-speech as "speech". */
const MODALITY_ALIASES: Record<string, ModelModality> = { speech: "audio" };

/** The output modality strings a provider declared, if it declared any. */
function declaredOutputs(raw: Record<string, unknown>): string[] {
  const arch = raw.architecture as
    | { output_modalities?: unknown; modality?: unknown }
    | undefined;
  const listed = Array.isArray(arch?.output_modalities)
    ? arch.output_modalities
    : [];
  const fromArch = listed.filter((m): m is string => typeof m === "string");
  if (fromArch.length) return fromArch;

  // Older shape: "text+image->text".
  const modality = typeof arch?.modality === "string" ? arch.modality : "";
  const outSide = modality.split("->")[1] ?? "";
  return outSide
    .split("+")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * What a model emits. The provider's own declaration always wins; the
 * id/label heuristic is a fallback for providers that declare nothing.
 *
 * Returns empty when everything declared is something no node can consume —
 * embeddings, transcription, rerank. Those must not fall through to the
 * heuristic, which defaults to "text" and would file all ~60 of OpenRouter's
 * into the AI Text picker.
 */
function outputsOf(
  raw: Record<string, unknown>,
  id: string,
  label: string,
): ModelModality[] {
  const declared = declaredOutputs(raw);
  if (!declared.length) return inferOutputs(id, label);
  // Only "speech" means text-to-speech. A bare "audio" (gpt-audio: text and
  // audio out) is a chat model that can talk; the Speech node calls the
  // /audio/speech endpoint, which rejects it, so it is not an audio model here.
  const mapped = declared
    .map((m) => m.toLowerCase())
    .filter((m) => m !== "audio")
    .map((m) => MODALITY_ALIASES[m] ?? m)
    .filter((m): m is ModelModality => MODALITIES.has(m as ModelModality));
  return [...new Set(mapped)];
}

function voicesOf(raw: Record<string, unknown>): string[] | undefined {
  const listed = raw.supported_voices;
  if (!Array.isArray(listed) || !listed.length) return;
  const voices = listed.filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0,
  );
  return voices.length ? voices : undefined;
}

/**
 * The last catalog OpenRouter served. When it can't be reached the picker is
 * handed this (flagged as an error, so availability checks stay "unknown")
 * instead of an empty list — new visitors have no browser cache to fall back on.
 */
let lastGood: {
  models: Record<string, ModelInfo[]>;
  suggested?: Partial<Record<NodeModelKind, ModelInfo[]>>;
} | null = null;

const KINDS: NodeModelKind[] = ["chat", "image", "audio", "video"];

/** Shortlists per node kind: admin pins, then most used, then newest. */
async function suggestionsOf(live: ModelInfo[]) {
  const pins = new Map<string, number>();
  for (const row of (await policyMap()).values())
    if (row.pinRank != null && row.enabled) pins.set(row.model, row.pinRank);
  // Usage is a bonus: a ledger hiccup must not take the whole catalog down.
  const usage = await recentModelUsage().catch(() => new Map<string, number>());
  const out: Partial<Record<NodeModelKind, ModelInfo[]>> = {};
  // Known-good models per kind, from what each node type ships with.
  const NODE_OF: Partial<Record<NodeModelKind, string>> = {
    image: "image.gen",
    video: "video.gen",
    audio: "tts",
  };
  for (const kind of KINDS) {
    const curated = (nodeDef(NODE_OF[kind] ?? "")?.models ?? []).map((m) => m.id);
    out[kind] = buildSuggestions({ live, kind, pins, usage, curated });
  }
  return out;
}

/**
 * POST /api/models
 * Returns the OpenRouter catalog (the one provider). Disabled models are
 * filtered out so pickers never offer something a run would reject.
 * OpenRouter is fetched with output_modalities=all (their default is
 * text-only).
 */
export async function POST() {
  const { baseUrl, apiKey } = providerCreds();
  const root = baseUrl.replace(/\/$/, "");

  const models: Record<string, ModelInfo[]> = {};
  const errors: Record<string, string> = {};
  let suggested: Partial<Record<NodeModelKind, ModelInfo[]>> | undefined;
  // OpenRouter serves its catalog publicly, so the picker can be filled
  // before a key is set; runs still require it.
  try {
    const start = `${root}/models?output_modalities=all`;
    const rows: Record<string, unknown>[] = [];
    let next: string | null = start;
    for (let page = 0; page < 6 && next; page++) {
      const href = next.startsWith("http") ? next : `${root}${next}`;
      const res = await fetch(href, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        errors.openrouter = `HTTP ${res.status}`;
        break;
      }
      const text = await res.text();
      if (!text.trim()) break;
      const j = JSON.parse(text) as {
        data?: unknown[];
        models?: unknown[];
        links?: { next?: string | null };
      };
      const chunk = (j.data ?? j.models ?? []) as Record<string, unknown>[];
      rows.push(...chunk);
      next = typeof j.links?.next === "string" ? j.links.next : null;
    }
    const disabled = await enabledModels();
    const list: ModelInfo[] = rows
      .filter((m) => typeof m?.id === "string")
      .map((m) => {
        const id = m.id as string;
        const label =
          (typeof m.display_name === "string" && m.display_name) ||
          (typeof m.name === "string" && m.name) ||
          id;
        return {
          id,
          label,
          outputs: outputsOf(m, id, label),
          voices: voicesOf(m),
          created: typeof m.created === "number" ? m.created : undefined,
        };
      })
      // nothing to wire a rerank or embedding model into
      .filter((m) => m.outputs.length)
      // admin-disabled models never appear in pickers
      .filter((m) => !disabled || disabled.has(m.id))
      .sort((a, b) => a.id.localeCompare(b.id));
    if (!errors.openrouter) {
      models.openrouter = list;
      suggested = await suggestionsOf(list);
      lastGood = { models: { openrouter: list }, suggested };
    }
  } catch (e) {
    errors.openrouter = e instanceof Error ? e.message : "model list fetch failed";
  }

  if (errors.openrouter && lastGood) {
    return NextResponse.json({ ...lastGood, errors, updatedAt: Date.now() });
  }
  return NextResponse.json({ models, suggested, errors, updatedAt: Date.now() });
}
