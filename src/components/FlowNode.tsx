"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Handle,
  Position,
  useEdges,
  useNodes,
  useStore,
  type NodeProps,
} from "@xyflow/react";
import {
  ArrowSquareOut,
  Check,
  Copy,
  DownloadSimple,
  Play,
  Trash,
  UploadSimple,
  X,
} from "@phosphor-icons/react";
import { nodeDef, type NodeTypeDef } from "@/lib/nodes";
import {
  CUSTOM_MODEL,
  filterModels,
  groupModels,
  kindForNode,
  liveList,
  modelName,
  type ModelInfo,
} from "@/lib/models";
import {
  RECENT_EVENT,
  pickRecentDefault,
  recentsFor,
  recordRecent,
  type RecentModel,
} from "@/lib/recent-models";
import { useCatalog } from "@/lib/model-catalog";
import { describeOutputs } from "@/lib/render";
import {
  CUSTOM_PARAM,
  IMAGE_ASPECTS,
  IMAGE_SIZES,
  VIDEO_ASPECTS,
  VIDEO_DURATIONS,
  VIDEO_RESOLUTIONS,
  resolveVoice,
  voiceChoices,
} from "@/lib/media-params";
import type { FlowNodeData, NodeOutput } from "@/lib/types";
import { OutputRenderer, downloadOutputs } from "./OutputRenderer";
import { SkillPicker } from "./SkillPicker";
import { toast } from "./Toast";
import { readJson } from "@/lib/http";
import { fmtUsd } from "@/lib/format";
import { NodeFrame, handleStyle, type PortPlacement } from "./node/NodeFrame";
import { PORT_NAME } from "./node/tokens";

const patch = (nodeId: string, p: Record<string, unknown>) =>
  window.dispatchEvent(
    new CustomEvent("kun:update", { detail: { nodeId, patch: p } }),
  );

const emit = (name: string, nodeId: string) =>
  window.dispatchEvent(new CustomEvent(name, { detail: { nodeId } }));

async function saveSkillToLibrary(nodeId: string, d: FlowNodeData) {
  if (!d.text?.trim() && !d.label?.trim()) {
    toast("Write some instructions first.", "error");
    return;
  }
  try {
    const res = await fetch("/api/skills", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: d.label !== "Skill" ? d.label : undefined,
        name: d.label !== "Skill" ? d.label : undefined,
        body: d.text ?? "",
      }),
    });
    const j = await readJson<{
      skill?: { slug: string; displayName: string; instructions?: string; body?: string };
      error?: string;
    }>(res);
    if (!res.ok || !j.skill) throw new Error(j.error || "Save failed");
    patch(nodeId, {
      skillId: j.skill.slug,
      label: j.skill.displayName,
      text: j.skill.instructions ?? j.skill.body ?? d.text,
    });
    toast(`Saved “${j.skill.displayName}”. It now appears in every skill picker.`, "ok");
  } catch (e) {
    toast(e instanceof Error ? e.message : "Save failed", "error");
  }
}

export function FlowNode({ id, data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  const def = nodeDef(d.kind);
  const [upl, setUpl] = useState(false);
  const [copied, setCopied] = useState(false);
  const cat = useCatalog();

  // Narrow subscription: re-render only when *this* node's wiring changes,
  // not on every drag of every other node.
  const wiring = useStore((s) => {
    const ins: string[] = [];
    const outs: string[] = [];
    for (const e of s.edges) {
      if (e.target === id) ins.push(e.targetHandle ?? "");
      if (e.source === id) outs.push(e.sourceHandle ?? "");
    }
    return `${ins.sort().join(",")}|${outs.sort().join(",")}`;
  });
  const connected = useMemo(() => {
    const [i, o] = wiring.split("|");
    return {
      in: new Set(i ? i.split(",") : []),
      out: new Set(o ? o.split(",") : []),
    };
  }, [wiring]);

  // Recently used models for this node kind, kept fresh across nodes.
  const [recents, setRecents] = useState<RecentModel[]>(() =>
    recentsFor(d.kind),
  );
  useEffect(() => {
    const on = () => setRecents(recentsFor(d.kind));
    window.addEventListener(RECENT_EVENT, on);
    return () => window.removeEventListener(RECENT_EVENT, on);
  }, [d.kind]);

  // Live OpenRouter list, trustworthy only when the last fetch succeeded
  // (liveList is null otherwise): the curated suggestions age, and picking a
  // retired id fails the run.
  const need = kindForNode(d.kind) ?? "chat";
  const live = liveList(cat.models, cat.errors);

  const defaultModel =
    recents.length || def?.models?.length
      ? pickRecentDefault(
          recents,
          def?.models ?? [],
          cat.models,
          cat.errors,
          need,
        ).model
      : "";

  useEffect(() => {
    if (d.kind !== "tts" || !d.voice) return;
    const modelId = d.model ?? defaultModel;
    const listed = voicesForModel(cat.models, modelId);
    if (!resolveVoice(modelId, d.voice, listed)) {
      patch(id, { voice: undefined });
    }
  }, [cat.models, defaultModel, d.kind, d.model, d.voice, id]);

  if (!def) return null;

  const isMediaIn = ["image.in", "audio.in", "video.in"].includes(d.kind);
  const isSink = d.kind.startsWith("out.");
  const isAi = ["llm", "image.gen", "tts", "video.gen"].includes(d.kind);
  const status = d.runStatus ?? "idle";
  const outputs = d.outputs ?? [];
  // live-streamed text (LLM nodes), shown while running
  const streaming = d.streamingText ?? "";
  const hasContent =
    outputs.some((o) => (o.type === "text" ? !!o.text.trim() : !!o.url)) ||
    (!!streaming && status === "running");
  // changing content replays the arrival animation
  const sig = JSON.stringify(
    outputs.map((o) => (o.type === "text" ? o.text.length : o.url)),
  );

  const upload = async (file: File) => {
    setUpl(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await readJson<{ id?: string; error?: string }>(res).catch(
        () => ({} as { id?: string; error?: string }),
      );
      if (!res.ok || !j.id) {
        const msg = typeof j.error === "string" ? j.error : "Upload failed";
        toast(msg, "error");
        patch(id, { runStatus: "error", runError: msg });
        return;
      }
      window.dispatchEvent(
        new CustomEvent("kun:set-artifact", {
          detail: { nodeId: id, artifactId: j.id },
        }),
      );
      patch(id, { runStatus: undefined, runError: undefined });
    } catch {
      toast("Upload failed", "error");
      patch(id, { runStatus: "error", runError: "Upload failed" });
    } finally {
      setUpl(false);
    }
  };

  const copy = async (t: string) => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(t);
      ok = true;
    } catch {
      // fallback for contexts where the async clipboard API is blocked
      const ta = document.createElement("textarea");
      ta.value = t;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      ta.remove();
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }
  };

  const toolbar = (
    <div className="kun-node__toolbar nodrag" role="toolbar" aria-label="Node actions">
      {status !== "running" && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            emit("kun:run-node", id);
          }}
          className="kun-node__tool"
          data-tone="run"
          title="Run this node (or double-click it)"
        >
          <Play size={11} weight="fill" aria-hidden />
          Run
        </button>
      )}
      {status !== "running" && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              emit("kun:duplicate-node", id);
            }}
            className="kun-node__tool"
            title="Duplicate node"
            aria-label="Duplicate node"
          >
            <Copy size={13} weight="bold" aria-hidden />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              emit("kun:remove-node", id);
            }}
            className="kun-node__tool"
            data-tone="danger"
            title="Delete node"
            aria-label="Delete node"
          >
            <Trash size={13} weight="bold" aria-hidden />
          </button>
        </>
      )}
    </div>
  );

  const renderHandle = (p: PortPlacement) => (
    <Handle
      key={`${p.side}-${p.port.id}`}
      id={p.port.id}
      type={p.side === "in" ? "target" : "source"}
      position={p.side === "in" ? Position.Left : Position.Right}
      style={handleStyle(p)}
      title={`${p.port.label} (${PORT_NAME[p.port.type]})`}
    />
  );

  return (
    <NodeFrame
      def={def}
      label={d.label}
      status={status}
      selected={selected}
      wide={isSink}
      cost={d.runUsage?.costUsd ? fmtUsd(d.runUsage.costUsd) : null}
      connected={connected}
      renderHandle={renderHandle}
      toolbar={toolbar}
    >
      <div className="space-y-2">
        {/* source editors */}
        {(d.kind === "text" || d.kind === "note") && (
          <textarea
            value={d.text ?? ""}
            onChange={(e) => patch(id, { text: e.target.value })}
            aria-label={d.kind === "note" ? "Instruction" : "Text"}
            placeholder={
              d.kind === "note" ? "Instruction…" : "Paste text or an article…"
            }
            rows={d.kind === "note" ? 2 : 5}
            className="kun-field nodrag nowheel resize-y"
          />
        )}

        {d.kind === "skill" && (
          <>
            <SkillPicker
              value={d.skillId}
              draft={{ displayName: d.label, body: d.text }}
              onPick={(s) =>
                patch(id, {
                  skillId: s?.slug,
                  label: s?.displayName ?? "Skill",
                  text: s?.instructions ?? s?.body ?? "",
                })
              }
            />
            <textarea
              value={d.text ?? ""}
              onChange={(e) => patch(id, { text: e.target.value })}
              aria-label="Skill instructions"
              placeholder="Skill instructions appear here. Edit them before wiring into an AI node."
              rows={5}
              className="kun-field nodrag nowheel resize-y"
            />
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => void saveSkillToLibrary(id, d)}
                className="nodrag kun-chip-select"
              >
                Save to library
              </button>
              <button
                type="button"
                onClick={() => emit("kun:expand-skill", id)}
                className="nodrag kun-chip-select"
              >
                Expand to image
              </button>
            </div>
          </>
        )}

        {d.kind === "tts" ? (
          <TtsPrompt id={id} value={d.prompt ?? ""} />
        ) : (
          (d.kind === "llm" ||
            d.kind === "image.gen" ||
            d.kind === "video.gen") && (
            <textarea
              value={d.prompt ?? ""}
              onChange={(e) => patch(id, { prompt: e.target.value })}
              aria-label="Prompt"
              placeholder={
                d.kind === "llm"
                  ? "What should the model do with the input…"
                  : d.kind === "image.gen"
                    ? "Describe the image, or how to edit the reference…"
                    : "Describe what to generate…"
              }
              rows={3}
              className="kun-field nodrag nowheel resize-y"
            />
          )
        )}

        {isAi && (
          <SkillPicker
            compact
            value={d.skillId}
            onPick={(s) => patch(id, { skillId: s?.slug })}
          />
        )}

        {def.models && def.models.length > 0 && (
          <ModelPicker
            id={id}
            d={d}
            def={def}
            defaultModel={defaultModel}
            recents={recents}
            live={live}
          />
        )}

        {d.kind === "image.gen" && (
          <div className="flex flex-wrap gap-1.5">
            <OptionalParam
              value={d.aspectRatio}
              onChange={(aspectRatio) =>
                patch(id, {
                  aspectRatio,
                  size: aspectRatio ? undefined : d.size,
                })
              }
              options={IMAGE_ASPECTS}
              autoLabel="Aspect: Auto"
              customPlaceholder="W:H, e.g. 16:9"
            />
            <OptionalParam
              value={d.size}
              onChange={(size) =>
                patch(id, {
                  size,
                  aspectRatio: size ? undefined : d.aspectRatio,
                })
              }
              options={IMAGE_SIZES}
              autoLabel="Size: Auto"
              customPlaceholder="1024x1024"
            />
          </div>
        )}

        {d.kind === "video.gen" && (
          <div className="flex flex-wrap gap-1.5">
            <OptionalParam
              value={d.duration != null ? String(d.duration) : undefined}
              onChange={(raw) =>
                patch(id, {
                  duration: raw ? Number(raw) || undefined : undefined,
                })
              }
              options={VIDEO_DURATIONS}
              autoLabel="Length: Auto"
              customPlaceholder="Seconds"
            />
            <OptionalParam
              value={d.aspectRatio}
              onChange={(aspectRatio) => patch(id, { aspectRatio })}
              options={VIDEO_ASPECTS}
              autoLabel="Aspect: Auto"
              customPlaceholder="W:H, e.g. 16:9"
            />
            <OptionalParam
              value={d.resolution}
              onChange={(resolution) => patch(id, { resolution })}
              options={VIDEO_RESOLUTIONS}
              autoLabel="Resolution: Auto"
              customPlaceholder="1920x1080"
            />
          </div>
        )}

        {d.kind === "tts" && (
          <div className="flex flex-wrap gap-1.5">
            <OptionalParam
              value={d.voice}
              onChange={(voice) => patch(id, { voice })}
              options={voiceChoices(
                d.model ?? defaultModel,
                voicesForModel(cat.models, d.model ?? defaultModel),
              )}
              autoLabel="Voice: Auto"
              customPlaceholder="This model's voice id"
            />
          </div>
        )}

        {/* media input */}
        {isMediaIn && (
          <label
            className={`nodrag flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed bg-sunken px-3 py-3 text-[12px] transition-colors ${
              upl
                ? "border-live/50 text-live"
                : "border-line2 text-muted hover:border-ink/40 hover:text-ink"
            }`}
          >
            <UploadSimple size={14} weight="bold" aria-hidden />
            {upl ? "Uploading…" : d.artifactId ? "Replace file" : "Choose file"}
            <input
              type="file"
              accept={
                d.kind === "image.in"
                  ? "image/*"
                  : d.kind === "audio.in"
                    ? "audio/*"
                    : "video/*"
              }
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
              }}
            />
          </label>
        )}
        {isMediaIn && d.artifactId && !upl && (
          <MediaPreview
            url={`/api/media/${d.artifactId}`}
            kind={d.kind.replace(".in", "")}
          />
        )}

        {/* Latest result of an AI node, so a graph reads at a glance. */}
        {isAi && (hasContent || status === "running") && (
          <ResultPreview
            outputs={outputs}
            streaming={status === "running" ? streaming : ""}
            running={status === "running"}
          />
        )}

        {/* Output sinks render whatever arrived: pages, apps, prose, JSON,
            media. */}
        {isSink &&
          (hasContent ? (
            <div key={sig} className="kun-rise space-y-2.5">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-[11px] text-faint">
                  {status === "running" && streaming
                    ? "Streaming…"
                    : describeOutputs(outputs)}
                </span>
                <div className="flex items-center gap-1">
                  {outputs.some((o) =>
                    o.type !== "text" ? !!o.url : !!o.text?.trim(),
                  ) && (
                    <button
                      type="button"
                      onClick={() => downloadOutputs(outputs)}
                      title="Download output"
                      className="nodrag kun-node__tool"
                    >
                      <DownloadSimple size={13} weight="bold" aria-hidden />
                      Save
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      copy(
                        outputs
                          .map((o) => (o.type === "text" ? o.text : (o.url ?? "")))
                          .join("\n\n"),
                      )
                    }
                    title="Copy raw output"
                    className="nodrag kun-node__tool"
                  >
                    {copied ? (
                      <Check size={13} weight="bold" aria-hidden />
                    ) : (
                      <Copy size={13} weight="bold" aria-hidden />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
              {status === "running" && streaming ? (
                <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-line bg-sunken px-3 py-2.5 font-mono text-[11px] leading-relaxed text-ink/85">
                  {streaming}
                  <span className="kun-caret" aria-hidden />
                </pre>
              ) : (
                outputs.map((o, i) =>
                  (o.type === "text" && !o.text.trim()) ||
                  (o.type !== "text" && !o.url) ? null : (
                    <OutputRenderer key={i} output={o} />
                  ),
                )
              )}
            </div>
          ) : status === "running" || status === "queued" ? (
            <div className="flex items-center gap-2 py-3 text-[12px] text-faint">
              <span className="kun-eq text-live" aria-hidden>
                <span />
                <span />
                <span />
              </span>
              Waiting for results…
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-line2 px-3 py-5 text-center">
              <p className="text-[12.5px] text-muted">No output yet</p>
              <p className="mt-0.5 text-[11.5px] text-faint">
                Connect something upstream, then run.
              </p>
            </div>
          ))}

        {status === "error" && (
          <div className="rounded-xl border border-err/40 bg-err/10 px-3 py-2 text-[11.5px] leading-snug text-err">
            {d.runError}
          </div>
        )}

        {status === "skipped" && (
          <div className="rounded-xl border border-dashed border-line2 px-3 py-2 text-[11.5px] leading-snug text-faint">
            {d.runError ?? "Skipped."}
          </div>
        )}
      </div>
    </NodeFrame>
  );
}

/**
 * Speech prompts fall back to whatever text arrives on the input. That needs
 * a subscription to every node and edge, so it lives here and only mounts for
 * speech nodes instead of taxing every card on the canvas.
 */
function TtsPrompt({ id, value }: { id: string; value: string }) {
  const incoming = useIncomingText(id);
  return (
    <textarea
      value={value.trim() ? value : incoming}
      onChange={(e) => patch(id, { prompt: e.target.value })}
      aria-label="Prompt"
      placeholder={
        incoming ? "Connected text will be spoken…" : "Text to speak…"
      }
      rows={3}
      className="kun-field nodrag nowheel resize-y"
    />
  );
}

function useIncomingText(nodeId: string) {
  const nodes = useNodes();
  const edges = useEdges();
  return useMemo(() => {
    const parts: string[] = [];
    for (const e of edges) {
      if (e.target !== nodeId) continue;
      const src = nodes.find((n) => n.id === e.source);
      if (!src) continue;
      const data = src.data as FlowNodeData;
      const fromOut = (data.outputs ?? [])
        .filter(
          (o): o is { type: "text"; text: string } =>
            o.type === "text" && !!o.text?.trim(),
        )
        .map((o) => o.text);
      if (fromOut.length) {
        parts.push(...fromOut);
        continue;
      }
      if (data.streamingText?.trim()) {
        parts.push(data.streamingText);
        continue;
      }
      if ((data.kind === "text" || data.kind === "note") && data.text?.trim()) {
        parts.push(data.text);
      }
    }
    return parts.join("\n\n");
  }, [edges, nodeId, nodes]);
}

function voicesForModel(
  catalogs: Record<string, ModelInfo[]>,
  modelId?: string,
): string[] | undefined {
  if (!modelId) return;
  for (const list of Object.values(catalogs)) {
    const hit = list?.find((m) => m.id === modelId);
    if (hit?.voices?.length) return hit.voices;
  }
}

function ModelPicker({
  id,
  d,
  def,
  defaultModel,
  recents,
  live,
}: {
  id: string;
  d: FlowNodeData;
  def: NodeTypeDef;
  defaultModel: string;
  recents: RecentModel[];
  live: ModelInfo[] | null;
}) {
  const cat = useCatalog();
  const [customModel, setCustomModel] = useState(false);

  const suggested = def.models ?? [];
  const need = kindForNode(d.kind);
  const seen = new Set<string>();
  const groups: { provider: string; label: string; items: ModelInfo[] }[] = [];

  const addGroup = (provider: string, label: string, items: ModelInfo[]) => {
    const unique = items.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
    if (unique.length) groups.push({ provider, label, items: unique });
  };

  // Recently used first: a personal, always-current basis, unlike the curated
  // suggestions. Labels come from the record, the live list, or the
  // suggestions, so a retired model keeps its name.
  const liveById = new Map((live ?? []).map((m) => [m.id, m.label]));
  addGroup(
    "recent",
    "Recent",
    recents.map((r) => ({
      id: r.id,
      label:
        r.label ??
        liveById.get(r.id) ??
        suggested.find((s) => s.id === r.id)?.label ??
        r.id,
    })),
  );

  addGroup("suggested", "Suggested", suggested);

  if (need) {
    for (const g of groupModels(filterModels(cat.models.openrouter ?? [], need))) {
      addGroup(g.provider, g.label, g.items);
    }
  }

  const knownIds = [...seen];
  const orphanGateway = !!d.provider && d.provider !== "openrouter" && !!d.model;
  const showCustom =
    !orphanGateway && (customModel || (!!d.model && !knownIds.includes(d.model)));

  // Suggested and recent ids are OpenRouter's namespace, so only they can be
  // checked against its live list. Gateway ids are their own.
  const listedIds = live ? new Set(live.map((m) => m.id)) : null;
  const orGone = "no longer listed by OpenRouter";
  const retiredNote = new Map<string, string>();
  if (listedIds) {
    for (const s of suggested)
      if (!listedIds.has(s.id)) retiredNote.set(s.id, orGone);
    for (const r of recents)
      if ((!r.provider || r.provider === "openrouter") && !listedIds.has(r.id))
        retiredNote.set(r.id, orGone);
  }

  const pickModel = (value: string) => {
    if (value === CUSTOM_MODEL) {
      setCustomModel(true);
      patch(id, { model: "", provider: "openrouter" });
      return;
    }
    const listed = voicesForModel(cat.models, value);
    const provider = "openrouter";
    const voice = resolveVoice(value, d.voice, listed);
    patch(id, {
      model: value,
      provider,
      ...(d.kind === "tts" ? { voice } : {}),
    });
    recordRecent(d.kind, {
      id: value,
      provider: provider === "openrouter" ? undefined : provider,
      label: groups.flatMap((g) => g.items).find((m) => m.id === value)?.label,
    });
  };

  if (orphanGateway || showCustom) {
    return (
      <div className="relative">
        <input
          value={d.model ?? ""}
          onChange={(e) => patch(id, { model: e.target.value })}
          autoComplete="off"
          spellCheck={false}
          aria-label="Custom model id"
          placeholder={
            orphanGateway
              ? "Gateway offline, model id kept…"
              : "provider/model (any OpenRouter id)…"
          }
          title={
            orphanGateway
              ? "Saved gateway model. It will run through its provider when reachable."
              : undefined
          }
          className="kun-field nodrag pr-8 font-mono text-[11px]"
        />
        {!orphanGateway && (
          <button
            type="button"
            onClick={() => {
              setCustomModel(false);
              patch(id, {
                model: defaultModel || knownIds[0],
                provider: "openrouter",
              });
            }}
            title="Back to preset models"
            aria-label="Back to preset models"
            className="nodrag absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-faint transition-colors hover:bg-ink/10 hover:text-ink"
          >
            <X size={10} weight="bold" aria-hidden />
          </button>
        )}
      </div>
    );
  }

  return (
    <select
      value={d.model ?? defaultModel}
      onChange={(e) => pickModel(e.target.value)}
      aria-label="Model"
      className="kun-chip-select nodrag w-full"
    >
      {groups.map((g) => (
        <optgroup key={`${g.provider}-${g.label}`} label={g.label}>
          {g.items.map((m) => {
            const note = retiredNote.get(m.id);
            return (
              <option
                key={m.id}
                value={m.id}
                disabled={!!note}
                title={note ? `${m.id}: ${note}` : m.id}
              >
                {modelName(m)}
              </option>
            );
          })}
        </optgroup>
      ))}
      <option value={CUSTOM_MODEL}>Custom model…</option>
    </select>
  );
}

function ResultPreview({
  outputs,
  streaming,
  running,
}: {
  outputs: NodeOutput[];
  streaming: string;
  running: boolean;
}) {
  const media = outputs.filter(
    (o): o is Exclude<NodeOutput, { type: "text" }> =>
      o.type !== "text" && !!o.url,
  );
  const text = outputs
    .filter((o): o is Extract<NodeOutput, { type: "text" }> => o.type === "text")
    .map((o) => o.text)
    .join("\n")
    .trim();

  if (running && streaming) {
    return (
      <pre className="kun-rise max-h-28 overflow-hidden whitespace-pre-wrap break-words rounded-xl border border-line bg-sunken px-3 py-2 font-mono text-[11px] leading-relaxed text-ink/85">
        {streaming.slice(-420)}
        <span className="kun-caret" aria-hidden />
      </pre>
    );
  }
  if (running && !media.length && !text) return null;

  return (
    <div className="kun-rise space-y-1.5">
      {media.map((o, i) => (
        <OutputRenderer key={i} output={o} />
      ))}
      {text && (
        <div className="flex items-start gap-2 rounded-xl border border-line bg-sunken px-3 py-2">
          <p className="line-clamp-4 min-w-0 flex-1 whitespace-pre-wrap break-words text-[12px] leading-relaxed text-ink/85">
            {text}
          </p>
          <ArrowSquareOut
            size={12}
            weight="bold"
            className="mt-0.5 shrink-0 text-faint"
            aria-label="Full text appears on an Output node"
          />
        </div>
      )}
    </div>
  );
}

function OptionalParam({
  value,
  onChange,
  options,
  autoLabel,
  customPlaceholder,
}: {
  value?: string;
  onChange: (next?: string) => void;
  options: readonly { value: string; label: string }[];
  autoLabel: string;
  customPlaceholder?: string;
}) {
  const [forceCustom, setForceCustom] = useState(false);
  const known = options.some((o) => o.value === value);
  const custom = forceCustom || (!!value && !known);
  const selectValue = custom ? CUSTOM_PARAM : (value ?? "");

  return (
    <div className="min-w-0">
      <select
        value={selectValue}
        aria-label={autoLabel}
        onChange={(e) => {
          const next = e.target.value;
          if (next === CUSTOM_PARAM) {
            setForceCustom(true);
            if (known) onChange(undefined);
            return;
          }
          setForceCustom(false);
          onChange(next || undefined);
        }}
        className="kun-chip-select nodrag"
      >
        <option value="">{autoLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        <option value={CUSTOM_PARAM}>Custom…</option>
      </select>
      {custom && (
        <input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value.trim() || undefined)}
          spellCheck={false}
          placeholder={customPlaceholder}
          aria-label={`${autoLabel} (custom)`}
          className="kun-field nodrag mt-1 font-mono text-[11px]"
        />
      )}
    </div>
  );
}

function MediaPreview({ url, kind }: { url: string; kind: string }) {
  if (!url) return null;
  if (kind === "image")
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        width={448}
        height={224}
        className="nowheel max-h-56 w-full rounded-xl border border-line object-cover"
      />
    );
  if (kind === "audio")
    return (
      <audio
        controls
        preload="metadata"
        src={url.includes("?") ? `${url}&play=1` : `${url}?play=1`}
        className="nodrag w-full"
      />
    );
  if (kind === "video")
    return (
      <video
        controls
        playsInline
        preload="metadata"
        src={url}
        className="nowheel max-h-56 w-full rounded-xl border border-line bg-black"
      />
    );
  return null;
}
