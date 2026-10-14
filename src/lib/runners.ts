import { generateImage, streamText, experimental_generateVideo } from "ai";
import type { LanguageModel, ImageModel } from "ai";
import type {
  NodeData,
  NodeOutput,
  RunEvent,
  UsageInfo,
} from "./types";
import { nodeDef } from "./nodes";
import {
  readArtifactBytes,
  saveArtifact,
  shrinkReferenceImage,
  sniffMime,
} from "./artifacts";
import { ensurePlayableAudio } from "./audio";
import { resolveProvider } from "./providers";
import { ProviderHttpError, withRetry } from "./provider-errors";
import { DEFAULT_TEXT_MODEL } from "./models";
import { firstVoiceFor, needsVoice, speechCostUsd } from "./speech-voices";
import { isModelEnabled, applyMargin } from "./model-policy";
import {
  requireAspect,
  requireDuration,
  requireSize,
  resolveVoice,
} from "./media-params";
import { getSkill, type SkillRecord } from "./skills";

/**
 * Node runners — every AI call goes through the provider registry
 * (AI SDK model instances), with per-node usage/cost tracking.
 */

export const DEFAULT_PROVIDER = "openrouter";

const DEFAULTS: Record<string, { provider: string; model: string }> = {
  llm: { provider: "openrouter", model: DEFAULT_TEXT_MODEL },
  "image.gen": {
    provider: "openrouter",
    model: "bytedance-seed/seedream-5-0-lite",
  },
  tts: { provider: "openrouter", model: "minimax/speech-2.8-turbo" },
  "video.gen": { provider: "openrouter", model: "bytedance/seedance-2.5" },
};

const mediaTypeOf = (v: unknown): "image" | "audio" | "video" | undefined =>
  v === "image" || v === "audio" || v === "video" ? v : undefined;

export const modelFor = (d: NodeData) =>
  d.model || DEFAULTS[d.kind]?.model || "";

export const providerFor = (d: NodeData) =>
  d.provider || DEFAULTS[d.kind]?.provider || DEFAULT_PROVIDER;

/** Collect text-ish inputs (strings) into prompt parts. */
function textInputs(inputs: Record<string, NodeOutput[]>) {
  for (const key of ["in", "prompt", "text"] as const) {
    const list = inputs[key];
    if (list?.some((o) => o.type === "text" && o.text.trim())) return list;
  }
  return [];
}

function promptFrom(
  inputs: Record<string, NodeOutput[]>,
  data: NodeData,
  skillBrief?: string,
) {
  const incoming = textInputs(inputs)
    .filter((o): o is { type: "text"; text: string } => o.type === "text")
    .map((o) => o.text)
    .join("\n\n");
  if (data.kind === "tts") {
    const spoken = data.prompt?.trim() || incoming;
    if (skillBrief?.trim() && spoken) return `${skillBrief.trim()}\n\n${spoken}`;
    return spoken;
  }
  const parts: string[] = [];
  if (skillBrief?.trim()) parts.push(skillBrief.trim());
  if (data.prompt?.trim()) parts.push(data.prompt.trim());
  if (incoming) parts.push(incoming);
  return parts.join("\n\n");
}

async function skillFor(data: NodeData, orgId?: string): Promise<SkillRecord | null> {
  if (!data.skillId) return null;
  return getSkill(orgId ?? "", data.skillId);
}

export interface RunCtx {
  emit: (e: RunEvent) => void;
  nodeId: string;
  orgId?: string;
  runId?: string;
}

export function usageFromUnknown(raw: unknown, extra?: Partial<UsageInfo>): UsageInfo {
  const found = { costUsd: undefined as number | undefined, tokensIn: undefined as number | undefined, tokensOut: undefined as number | undefined };
  const walk = (v: unknown, depth: number) => {
    if (depth > 6 || !v || typeof v !== "object") return;
    const o = v as Record<string, unknown>;
    if (found.costUsd == null) {
      const cost = o.cost ?? o.costUsd ?? o.total_cost;
      if (typeof cost === "number" && Number.isFinite(cost) && cost > 0)
        found.costUsd = cost;
    }
    if (found.tokensIn == null) {
      const n = o.prompt_tokens ?? o.inputTokens ?? o.tokensIn;
      if (typeof n === "number") found.tokensIn = n;
    }
    if (found.tokensOut == null) {
      const n = o.completion_tokens ?? o.outputTokens ?? o.tokensOut;
      if (typeof n === "number") found.tokensOut = n;
    }
    for (const key of ["usage", "providerMetadata", "openrouter", "responses"]) {
      const child = o[key];
      if (Array.isArray(child)) child.forEach((item) => walk(item, depth + 1));
      else walk(child, depth + 1);
    }
  };
  walk(raw, 0);
  return { ...found, ...extra };
}

/** Usage metadata is a bonus — a provider that omits it must not fail a node. */
const optional = <T,>(p: PromiseLike<T>) =>
  Promise.resolve(p).catch(() => undefined);

export interface NodeResult {
  outputs: NodeOutput[];
  usage?: UsageInfo;
}

export async function runNode(
  nodeId: string,
  data: NodeData,
  inputs: Record<string, NodeOutput[]>,
  ctx: RunCtx,
): Promise<NodeResult> {
  switch (data.kind) {
    case "text":
    case "note": {
      // A Text node upgraded from a Skill node may hold only the skill id.
      if (!data.text?.trim() && data.skillId) {
        const skill = await skillFor(data, ctx.orgId);
        if (skill?.instructions)
          return { outputs: [{ type: "text", text: skill.instructions }] };
      }
      return { outputs: [{ type: "text", text: data.text ?? "" }] };
    }

    case "skill": {
      if (data.text?.trim()) {
        return { outputs: [{ type: "text", text: data.text }] };
      }
      const skill = await skillFor(data, ctx.orgId);
      return {
        outputs: [{ type: "text", text: skill?.instructions ?? "" }],
      };
    }

    case "file.in": {
      if (!data.artifactId) return { outputs: [] };
      const kind = mediaTypeOf(data.mediaType) ?? "image";
      return {
        outputs: [
          { type: kind, artifactId: data.artifactId, url: `/api/media/${data.artifactId}` },
        ],
      };
    }

    case "image.in":
    case "audio.in":
    case "video.in": {
      if (!data.artifactId) return { outputs: [] };
      const kind = data.kind.split(".")[0] as "image" | "audio" | "video";
      return {
        outputs: [
          { type: kind, artifactId: data.artifactId, url: `/api/media/${data.artifactId}` },
        ],
      };
    }

    case "llm": {
      const skill = await skillFor(data, ctx.orgId);
      const prompt = promptFrom(inputs, data);
      if (!prompt.trim() && !skill?.instructions) return { outputs: [] };
      const model = modelFor(data);
      if (!(await isModelEnabled(model)))
        throw new Error(`Model "${model}" is disabled by the administrator.`);
      const p = resolveProvider();
      // vision: attach first upstream image
      const image = (inputs.image ?? []).find((o) => o.type === "image") as
        | { type: "image"; url?: string; artifactId?: string }
        | undefined;

      const userText = prompt.trim() || "Follow the skill instructions.";
      const content: Array<
        | { type: "text"; text: string }
        | { type: "file"; data: Uint8Array | URL; mediaType: string }
      > = [{ type: "text", text: userText }];
      if (image?.url || image?.artifactId) {
        const file = await loadImageFile(image);
        content.push({ type: "file", ...file });
      }

      const result = streamText({
        model: p.gw.chat(model) as LanguageModel,
        ...(skill?.instructions ? { system: skill.instructions } : {}),
        messages: [{ role: "user", content }],
        temperature: data.temperature,
        // handled off `fullStream` below; the SDK's default handler would
        // also dump the whole error object to the server log
        onError: () => {},
      });

      // Stream deltas to the canvas as they arrive. `fullStream` is used over
      // `textStream` because it also carries the provider's error parts —
      // otherwise a failed request only surfaces as the AI SDK's generic
      // "No output generated" once the result promises are awaited.
      let text = "";
      for await (const part of result.fullStream) {
        if (part.type === "text-delta") {
          text += part.text;
          ctx.emit({ type: "delta", nodeId, text: part.text, ts: Date.now() });
        } else if (part.type === "error") {
          throw asError(part.error);
        }
      }
      if (!text.trim())
        throw new Error(`Model "${model}" returned no text.`);
      const u = await optional(result.usage);
      const meta = await optional(result.providerMetadata);
      const fromMeta = usageFromUnknown(
        { usage: u, providerMetadata: meta },
        { model },
      );
      return {
        outputs: [{ type: "text", text }],
        usage: await applyMargin(model, {
          tokensIn: fromMeta.tokensIn ?? u?.inputTokens,
          tokensOut: fromMeta.tokensOut ?? u?.outputTokens,
          costUsd: fromMeta.costUsd,
          model,
        }),
      };
    }

    case "image.gen": {
      const skill = await skillFor(data, ctx.orgId);
      const prompt = promptFrom(inputs, data, skill?.brief);
      const refs = (inputs.image ?? []).filter(
        (o): o is { type: "image"; url?: string; artifactId?: string } =>
          o.type === "image",
      );
      if (!prompt.trim() && !refs.length) return { outputs: [] };
      const model = modelFor(data);
      if (!(await isModelEnabled(model)))
        throw new Error(`Model "${model}" is disabled by the administrator.`);
      const p = resolveProvider();

      const images: Array<Uint8Array | string> = [];
      for (const ref of refs) images.push(await loadImageBytes(ref));

      const text =
        prompt ||
        (images.length
          ? "Keep the main subject of the reference image. Replace only the background with a professional complementary scene. Output a finished photograph."
          : "abstract composition");

      const size = requireSize(data.size);
      const aspectRatio = size ? undefined : requireAspect(data.aspectRatio);

      // The SDK's own retries stay off: withRetry re-sends only on failures
      // that never returned an image, so a retry can't bill twice.
      const generated = await withRetry(() =>
        generateImage({
          model: p.gw.imageModel(model) as unknown as ImageModel,
          prompt: images.length ? { text, images } : text,
          maxRetries: 0,
          ...(size ? { size } : {}),
          ...(aspectRatio ? { aspectRatio } : {}),
        }),
      );
      const image = generated.image;
      const art = await saveArtifact(
        image.uint8Array,
        image.mediaType || "image/png",
        "image",
        ctx.runId,
        ctx.orgId ?? "",
      );
      return {
        outputs: [
          { type: "image", artifactId: art.id, url: `/api/media/${art.id}` },
        ],
        usage: await applyMargin(model, usageFromUnknown(generated, { model })),
      };
    }

    case "tts": {
      const skill = await skillFor(data, ctx.orgId);
      const prompt = promptFrom(inputs, data, skill?.brief);
      if (!prompt.trim()) return { outputs: [] };
      // The provider instance has no speech model — call the provider's
      // OpenAI-compatible speech endpoint directly.
      const model = modelFor(data);
      if (!(await isModelEnabled(model)))
        throw new Error(`Model "${model}" is disabled by the administrator.`);
      const p = resolveProvider();
      const voice = resolveVoice(model, data.voice);
      const speak = (voiceId?: string) => withRetry(async () => {
        const r = await fetch(`${p.baseUrl.replace(/\/$/, "")}/audio/speech`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${p.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            input: prompt.slice(0, 4000),
            response_format: "mp3",
            ...(voiceId ? { voice: voiceId } : {}),
          }),
        });
        if (!r.ok) {
          throw new ProviderHttpError(
            `TTS failed (${r.status}): ${(await r.text()).slice(0, 300)}`,
            r.status,
          );
        }
        return r;
      });
      // Auto means "send no voice"; a model that insists on one gets its first.
      const res = await speak(voice).catch(async (e) => {
        if (voice || !(e instanceof ProviderHttpError) || !needsVoice(e.status, e.message))
          throw e;
        const fallback = await firstVoiceFor(p.baseUrl, model).catch(() => undefined);
        if (!fallback) throw e;
        return speak(fallback);
      });
      const buf = new Uint8Array(await res.arrayBuffer());
      const mime = res.headers.get("content-type") || "audio/mpeg";
      if (mime.includes("json") || mime.includes("application/json"))
        throw new Error("TTS returned JSON, expected audio");
      const playable = ensurePlayableAudio(buf, mime);
      const art = await saveArtifact(
        playable.data,
        playable.mime,
        "audio",
        ctx.runId,
        ctx.orgId ?? "",
      );
      const headerCost = Number(res.headers.get("x-openrouter-cost") || "");
      // No cost header: price it from the catalog's per-character rate, so the
      // platform's spend is recorded rather than billed as zero.
      const spoken = prompt.slice(0, 4000);
      const rateCost =
        Number.isFinite(headerCost) && headerCost > 0
          ? undefined
          : await speechCostUsd(p.baseUrl, model, spoken.length).catch(() => undefined);
      return {
        outputs: [
          { type: "audio", artifactId: art.id, url: `/api/media/${art.id}` },
        ],
        usage: await applyMargin(model, {
          model,
          costUsd:
            Number.isFinite(headerCost) && headerCost > 0 ? headerCost : rateCost,
        }),
      };
    }

    case "video.gen": {
      const skill = await skillFor(data, ctx.orgId);
      const prompt = promptFrom(inputs, data, skill?.brief);
      const firstFrame = (inputs.image ?? []).find(
        (o) => o.type === "image",
      ) as { type: "image"; artifactId?: string; url?: string } | undefined;
      if (!prompt.trim() && !firstFrame) return { outputs: [] };

      const model = modelFor(data);
      if (!(await isModelEnabled(model)))
        throw new Error(`Model "${model}" is disabled by the administrator.`);
      const p = resolveProvider();
      let frameImages:
        | { image: Uint8Array | string; frameType: "first_frame" }[]
        | undefined;
      if (firstFrame) {
        frameImages = [
          { image: await loadImageBytes(firstFrame), frameType: "first_frame" },
        ];
      }

      const aspectRatio = requireAspect(data.aspectRatio);
      const resolution = requireSize(data.resolution, "resolution");
      const duration = requireDuration(data.duration);

      const generated = await withRetry(() => experimental_generateVideo({
        model: p.gw.videoModel(model),
        prompt: prompt || "",
        frameImages,
        ...(aspectRatio ? { aspectRatio } : {}),
        ...(resolution ? { resolution } : {}),
        ...(duration ? { duration } : {}),
        download: async ({ url }) => {
          const r = await fetch(url, {
            headers: p.apiKey
              ? { Authorization: `Bearer ${p.apiKey}` }
              : undefined,
          });
          const data = new Uint8Array(await r.arrayBuffer());
          const mime = r.headers.get("content-type") || "video/mp4";
          if (!r.ok || mime.includes("json") || data[0] === 0x7b) {
            const preview = new TextDecoder().decode(data.slice(0, 180));
            throw new Error(
              `Video download failed (${r.status}): ${preview || r.statusText}`,
            );
          }
          return {
            data,
            mediaType: mime.includes("video") ? mime : "video/mp4",
          };
        },
      }), { tries: 2 });
      const v = generated.videos[0];
      if (!v) throw new Error("Video generation returned no videos");
      const art = await saveArtifact(
        v.uint8Array,
        "video/mp4",
        "video",
        ctx.runId,
        ctx.orgId ?? "",
      );
      return {
        outputs: [
          { type: "video", artifactId: art.id, url: `/api/media/${art.id}` },
        ],
        usage: await applyMargin(model, usageFromUnknown(generated, { model })),
      };
    }

    case "out.text": {
      // The one Output node: passes along everything that arrived, on its
      // single input or on a handle an older graph used.
      return { outputs: Object.values(inputs).flat() };
    }

    case "out.media": {
      const outs: NodeOutput[] = [];
      const img = (inputs.in ?? []).find((o) => o.type === "image");
      if (img) outs.push(img);
      const aud = (inputs.audio ?? []).find((o) => o.type === "audio");
      if (aud) outs.push(aud);
      const vid = (inputs.video ?? []).find((o) => o.type === "video");
      if (vid) outs.push(vid);
      return { outputs: outs };
    }

    default:
      return { outputs: [] };
  }
}

/** The readable part of a provider's error body, ignoring its envelope. */
function detailOf(body: unknown): string {
  if (typeof body !== "string" || !body.trim()) return "";
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: unknown };
      message?: unknown;
    };
    const msg = parsed.error?.message ?? parsed.message;
    return typeof msg === "string" ? msg.trim() : "";
  } catch {
    return body.trim().slice(0, 300);
  }
}

/**
 * Providers report failures as stream parts rather than thrown errors, and
 * the useful detail often sits in `responseBody` instead of the message.
 */
export function asError(e: unknown): Error {
  if (!(e instanceof Error))
    return new Error(typeof e === "string" ? e : JSON.stringify(e));
  const detail = detailOf((e as { responseBody?: unknown }).responseBody);
  return detail && !e.message.includes(detail)
    ? new Error(`${e.message} — ${detail}`)
    : e;
}

const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

/**
 * Image for a model request. Our own artifacts are inlined as bytes: a model
 * provider cannot reach this origin, and the AI SDK refuses to download
 * private hosts ("URL with hostname localhost is not allowed").
 */
async function loadImageFile(img: {
  url?: string;
  artifactId?: string;
}): Promise<{ data: Uint8Array | URL; mediaType: string }> {
  const id = img.artifactId ?? img.url?.match(/\/api\/media\/([^/?#]+)/)?.[1];
  if (id) {
    const hit = await readArtifactBytes(id);
    if (hit) {
      const data = shrinkReferenceImage(hit.data);
      return { data, mediaType: sniffMime(data, hit.mimeType || "image/png") };
    }
  }
  if (img.url?.startsWith("http")) {
    const ext = new URL(img.url).pathname.split(".").pop()?.toLowerCase() ?? "";
    return { data: new URL(img.url), mediaType: IMAGE_MIME[ext] ?? "image/png" };
  }
  throw new Error(
    "The upstream image is no longer available — re-upload it and run again.",
  );
}

/** Same image, in the shape the image/video generation calls accept. */
async function loadImageBytes(img: { url?: string; artifactId?: string }) {
  const { data } = await loadImageFile(img);
  return data instanceof URL ? data.toString() : data;
}

export { nodeDef };
