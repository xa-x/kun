"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Handle,
  Position,
  useEdges,
  useNodes,
  type NodeProps,
} from "@xyflow/react";
import { nodeDef, type PortType } from "@/lib/nodes";
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

/** Legacy gateway tags may persist on old nodes; everything runs on OpenRouter. */
const gateways: string[] = [];
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
import type { FlowNodeData } from "@/lib/types";
import { OutputRenderer, downloadOutputs } from "./OutputRenderer";
import { SkillPicker } from "./SkillPicker";
import { toast } from "./Toast";
import { readJson } from "@/lib/http";
import { fmtUsd } from "@/lib/format";

const PORT_COLORS: Record<PortType, string> = {
  text: "#3b82f6",
  image: "#22c55e",
  audio: "#ef4444",
  video: "#60a5fa",
  json: "#8a8a8a",
};

// Port rows stack from the top of the body on the left edge.
const ROW_H = 24;
const FIRST_ROW = 12;
// Visual port size — keep in sync with .react-flow__handle in globals.css.
const HANDLE = 11;

const patch = (nodeId: string, p: Record<string, unknown>) =>
  window.dispatchEvent(
    new CustomEvent("kun:update", { detail: { nodeId, patch: p } }),
  );

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
  const [customModel, setCustomModel] = useState(false);
  const cat = useCatalog();
  const incomingText = useIncomingText(id);

  // Live OpenRouter list, trustworthy only when the last fetch succeeded
  // (liveList is null otherwise) — the curated suggestions below age, and
  // picking a retired id fails the run.
  const need = kindForNode(d.kind) ?? "chat";
  const live = liveList(cat.models, cat.errors);

  // Recently used models for this node kind, kept fresh across nodes.
  const [recents, setRecents] = useState<RecentModel[]>(() =>
    recentsFor(d.kind),
  );
  useEffect(() => {
    const on = () => setRecents(recentsFor(d.kind));
    window.addEventListener(RECENT_EVENT, on);
    return () => window.removeEventListener(RECENT_EVENT, on);
  }, [d.kind]);

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
  const status = d.runStatus ?? "idle";
  const outputs = d.outputs ?? [];
  // live-streamed text (LLM nodes) — shown while running
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
        const msg =
          typeof j.error === "string" ? j.error : "Upload failed";
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

  return (
    <div
      className={`kun-node group ${isSink ? "w-[340px]" : "w-[264px]"} st-${status} ${selected ? "is-selected" : ""}`}
    >
      {status === "running" && <span className="kun-shimmer" />}

      {/* header */}
      <header
        className="flex h-9 items-center gap-2 border-b border-line/70 px-3"
        title="Double-click to run"
      >
        <span
          className="kun-dot h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: def.color }}
        />
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">
          {d.label || def.label}
        </span>

        {status !== "running" && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              window.dispatchEvent(
                new CustomEvent("kun:run-node", {
                  detail: { nodeId: id },
                }),
              );
            }}
            title="Run this node"
            aria-label="Run this node"
            className="nodrag -mr-0.5 flex h-5 w-5 items-center justify-center rounded text-faint opacity-0 transition focus-visible:opacity-100 hover:bg-white/5 hover:text-live group-hover:opacity-100"
          >
            <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden>
              <path d="M1.5 0.8 8.5 5 1.5 9.2Z" fill="currentColor" />
            </svg>
          </button>
        )}

        {status !== "running" && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.dispatchEvent(
                  new CustomEvent("kun:duplicate-node", {
                    detail: { nodeId: id },
                  }),
                );
              }}
              title="Duplicate node"
              aria-label="Duplicate node"
              className="nodrag flex h-5 w-5 items-center justify-center rounded text-faint opacity-0 transition focus-visible:opacity-100 hover:bg-white/5 hover:text-ink group-hover:opacity-100"
            >
              <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden>
                <rect x="0.8" y="2.4" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
                <path d="M3.2 2.4V1.6A.8.8 0 0 1 4 .8h4.4A.8.8 0 0 1 9.2 1.6V6a.8.8 0 0 1-.8.8H7.6" stroke="currentColor" strokeWidth="1.2" fill="none" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.dispatchEvent(
                  new CustomEvent("kun:remove-node", {
                    detail: { nodeId: id },
                  }),
                );
              }}
              title="Delete node"
              aria-label="Delete node"
              className="nodrag flex h-5 w-5 items-center justify-center rounded text-faint opacity-0 transition focus-visible:opacity-100 hover:bg-white/5 hover:text-err group-hover:opacity-100"
            >
              <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden>
                <path
                  d="M1.5 1.5 6.5 6.5M6.5 1.5 1.5 6.5"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </>
        )}

        <StatusMark status={status} />
        {d.runUsage?.costUsd ? (
          <span className="font-mono text-[9px] text-faint" title="Node cost">
            {fmtUsd(d.runUsage.costUsd)}
          </span>
        ) : null}
      </header>

      {/* body */}
      <div
        className="relative px-3 pb-3"
        style={{ paddingTop: def.inputs.length ? FIRST_ROW + def.inputs.length * ROW_H : 12 }}
      >
        {/* input ports */}
        {def.inputs.map((p, i) => {
          const mid = FIRST_ROW + i * ROW_H;
          return (
            <span key={p.id}>
              <Handle
                id={p.id}
                type="target"
                position={Position.Left}
                style={{
                  background: PORT_COLORS[p.type],
                  left: -HANDLE / 2,
                  top: mid - HANDLE / 2,
                }}
                title={`${p.label} (${p.type})`}
              />
              <span
                className="pointer-events-none absolute left-4 flex h-4 items-center font-mono text-[9px] uppercase tracking-[0.14em] text-faint"
                style={{ top: mid - 8 }}
              >
                {p.label}
              </span>
            </span>
          );
        })}

        {/* output ports — single is centered; multiple stack like inputs */}
        {def.outputs.map((p, i) => {
          const many = def.outputs.length > 1;
          const mid = many ? FIRST_ROW + i * ROW_H : null;
          return (
            <span key={p.id}>
              <Handle
                id={p.id}
                type="source"
                position={Position.Right}
                style={{
                  background: PORT_COLORS[p.type],
                  right: -HANDLE / 2,
                  top: mid !== null ? mid - HANDLE / 2 : "50%",
                  marginTop: mid !== null ? 0 : -HANDLE / 2,
                }}
                title={`${p.label} (${p.type})`}
              />
              {many && (
                <span
                  className="pointer-events-none absolute right-4 flex h-4 items-center font-mono text-[9px] uppercase tracking-[0.14em] text-faint"
                  style={{ top: mid! - 8 }}
                >
                  {p.label}
                </span>
              )}
            </span>
          );
        })}

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
            className="nodrag nowheel w-full resize-y rounded-md border border-line bg-sunken px-2 py-1.5 text-[12px] leading-relaxed text-ink/85 outline-none transition-colors placeholder:text-faint focus:border-line2"
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
              placeholder="Skill instructions appear here — edit before wiring into an AI node…"
              rows={5}
              className="nodrag nowheel mb-2 w-full resize-y rounded-md border border-line bg-sunken px-2 py-1.5 text-[12px] leading-relaxed text-ink/85 outline-none transition-colors placeholder:text-faint focus:border-line2"
            />
            <div className="mb-2 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => void saveSkillToLibrary(id, d)}
                className="nodrag rounded-md border border-line px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-muted transition-colors hover:border-line2 hover:text-ink"
              >
                Save to library
              </button>
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("kun:expand-skill", { detail: { nodeId: id } }),
                  )
                }
                className="nodrag rounded-md border border-line px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-muted transition-colors hover:border-line2 hover:text-ink"
              >
                Expand to image
              </button>
            </div>
          </>
        )}

        {(d.kind === "llm" ||
          d.kind === "image.gen" ||
          d.kind === "video.gen" ||
          d.kind === "tts") && (
          <textarea
            value={
              d.kind === "tts" && !d.prompt?.trim()
                ? incomingText
                : (d.prompt ?? "")
            }
            onChange={(e) => patch(id, { prompt: e.target.value })}
            aria-label="Prompt"
            placeholder={
              d.kind === "llm"
                ? "What should the model do with the input…"
                : d.kind === "image.gen"
                  ? "Describe the image — or how to edit the reference…"
                  : d.kind === "tts"
                    ? incomingText
                      ? "Connected text will be spoken…"
                      : "Text to speak…"
                    : "Describe what to generate…"
            }
            rows={3}
            className="nodrag nowheel mb-2 w-full resize-y rounded-md border border-line bg-sunken px-2 py-1.5 text-[12px] leading-relaxed text-ink/85 outline-none transition-colors placeholder:text-faint focus:border-line2"
          />
        )}

        {(d.kind === "llm" ||
          d.kind === "image.gen" ||
          d.kind === "video.gen" ||
          d.kind === "tts") && (
          <SkillPicker
            compact
            value={d.skillId}
            onPick={(s) => patch(id, { skillId: s?.slug })}
          />
        )}

        {def.models && def.models.length > 0 && (() => {
          const suggested = def.models ?? [];
          const need = kindForNode(d.kind);
          const seen = new Set<string>();
          const groups: { provider: string; label: string; items: ModelInfo[] }[] =
            [];

          const addGroup = (
            provider: string,
            label: string,
            items: ModelInfo[],
          ) => {
            const unique = items.filter((m) => {
              if (seen.has(m.id)) return false;
              seen.add(m.id);
              return true;
            });
            if (unique.length) groups.push({ provider, label, items: unique });
          };

          // Recently used first — a personal, always-current basis, unlike
          // the curated suggestions. Labels come from the record, the live
          // list, or the suggestions, so a retired model keeps its name.
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
            for (const g of groupModels(
              filterModels(cat.models.openrouter ?? [], need),
            )) {
              addGroup(g.provider, g.label, g.items);
            }
          }

          const knownIds = [...seen];
          const orphanGateway =
            !!d.provider && d.provider !== "openrouter" && !!d.model;
          const showCustom =
            !orphanGateway &&
            (customModel || (!!d.model && !knownIds.includes(d.model)));

          // Suggested and recent ids are OpenRouter's namespace, so only
          // they can be checked against its live list — gateway ids are
          // their own.
          const listedIds = live ? new Set(live.map((m) => m.id)) : null;
          const orGone = "no longer listed by OpenRouter";
          const retiredNote = new Map<string, string>();
          if (listedIds) {
            for (const s of suggested)
              if (!listedIds.has(s.id)) retiredNote.set(s.id, orGone);
            for (const r of recents)
              if (
                (!r.provider || r.provider === "openrouter") &&
                !listedIds.has(r.id)
              )
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
              label: groups
                .flatMap((g) => g.items)
                .find((m) => m.id === value)?.label,
            });
          };

          return (
            <>
              {orphanGateway || showCustom ? (
                <div className="relative mb-2">
                  <input
                    value={d.model ?? ""}
                    onChange={(e) => patch(id, { model: e.target.value })}
                    autoComplete="off"
                    spellCheck={false}
                    aria-label="Custom model id"
                    placeholder={
                      orphanGateway
                        ? "gateway offline — model id kept…"
                        : "provider/model — any OpenRouter id…"
                    }
                    title={
                      orphanGateway
                        ? "Saved gateway model — it will run through its provider when reachable"
                        : undefined
                    }
                    className="nodrag w-full rounded-md border border-accent/40 bg-sunken px-2 py-1.5 pr-7 font-mono text-[10.5px] text-ink/85 outline-none transition-colors placeholder:text-faint focus:border-accent"
                  />
                  {!orphanGateway && (
                    <button
                      onClick={() => {
                        setCustomModel(false);
                        patch(id, {
                          model: defaultModel || knownIds[0],
                          provider: "openrouter",
                        });
                      }}
                      title="Back to preset models"
                      aria-label="Back to preset models"
                      className="absolute right-1.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded text-faint transition-colors hover:bg-white/5 hover:text-muted"
                    >
                      <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden>
                        <path d="M1.5 1.5 6.5 6.5M6.5 1.5 1.5 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                </div>
              ) : (
                <select
                  value={d.model ?? defaultModel}
                  onChange={(e) => pickModel(e.target.value)}
                  className="nodrag mb-2 w-full rounded-md border border-line bg-sunken px-2 py-1.5 font-mono text-[10.5px] text-muted outline-none transition-colors focus:border-line2"
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
                            title={note ? `${m.id} — ${note}` : m.id}
                          >
                            {modelName(m)}
                          </option>
                        );
                      })}
                    </optgroup>
                  ))}
                  <option value={CUSTOM_MODEL}>Custom model…</option>
                </select>
              )}
            </>
          );
        })()}

        {d.kind === "image.gen" && (
          <div className="mb-2 grid grid-cols-2 gap-1.5">
            <OptionalParam
              value={d.aspectRatio}
              onChange={(aspectRatio) =>
                patch(id, {
                  aspectRatio,
                  size: aspectRatio ? undefined : d.size,
                })
              }
              options={IMAGE_ASPECTS}
              autoLabel="Aspect · Auto"
              customPlaceholder="W:H — 16:9"
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
              autoLabel="Size · Auto"
              customPlaceholder="1024x1024"
            />
          </div>
        )}

        {d.kind === "video.gen" && (
          <div className="mb-2 space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              <OptionalParam
                value={d.duration != null ? String(d.duration) : undefined}
                onChange={(raw) =>
                  patch(id, {
                    duration: raw ? Number(raw) || undefined : undefined,
                  })
                }
                options={VIDEO_DURATIONS}
                autoLabel="Length · Auto"
                customPlaceholder="Seconds"
              />
              <OptionalParam
                value={d.aspectRatio}
                onChange={(aspectRatio) => patch(id, { aspectRatio })}
                options={VIDEO_ASPECTS}
                autoLabel="Aspect · Auto"
                customPlaceholder="W:H — 16:9"
              />
            </div>
            <OptionalParam
              value={d.resolution}
              onChange={(resolution) => patch(id, { resolution })}
              options={VIDEO_RESOLUTIONS}
              autoLabel="Resolution · Auto"
              customPlaceholder="1920x1080"
            />
          </div>
        )}

        {d.kind === "tts" && (
          <OptionalParam
            value={d.voice}
            onChange={(voice) => patch(id, { voice })}
            options={voiceChoices(
              d.model ?? defaultModel,
              voicesForModel(cat.models, d.model ?? defaultModel),
            )}
            autoLabel="Voice · Auto"
            customPlaceholder="this model's voice id"
            className="mb-2"
          />
        )}

        {/* media input */}
        {isMediaIn && (
          <label
            className={`nodrag flex cursor-pointer items-center justify-center rounded-md border border-dashed bg-sunken px-2 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
              upl
                ? "border-live/50 text-live"
                : "border-line2 text-muted hover:border-accent/60 hover:text-ink"
            }`}
          >
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

        {/* ---------------------------------------------------------------
            Output. Renders whatever arrived — pages, apps, prose, JSON,
            media — processing nodes stay clean; results live here only.
        ---------------------------------------------------------------- */}
        {isSink &&
          (hasContent ? (
            <div key={sig} className="kun-rise space-y-2.5">
              <div className="flex items-center justify-between px-0.5">
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
                  {status === "running" && streaming
                    ? "streaming…"
                    : describeOutputs(outputs)}
                </span>
                <div className="flex items-center gap-2">
                  {outputs.some((o) => o.type !== "text" ? !!o.url : !!o.text?.trim()) && (
                    <button
                      onClick={() => downloadOutputs(outputs)}
                      title="Download output"
                      className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted transition-colors hover:text-live"
                    >
                      Download
                    </button>
                  )}
                  <button
                    onClick={() => copy(outputs.map((o) => (o.type === "text" ? o.text : o.url ?? "")).join("\n\n"))}
                    title="Copy raw output"
                    className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted transition-colors hover:text-live"
                  >
                    {copied ? "Copied ✓" : "Copy"}
                  </button>
                </div>
              </div>
              {status === "running" && streaming ? (
                <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-sunken px-2.5 py-2 font-mono text-[10.5px] leading-relaxed text-ink/80">
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
            <div className="flex items-center gap-2 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
              <Spinner className="text-live" />
              Awaiting results…
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-line px-3 py-5 text-center">
              <p className="text-[12px] text-muted">No output yet.</p>
              <p className="mt-0.5 text-[11px] text-faint">
                Connect upstream and run — or chain this node onward.
              </p>
            </div>
          ))}

        {status === "error" && (
          <div className="mt-2 rounded-md border border-err/40 bg-err/10 px-2.5 py-2 text-[11px] leading-snug text-err">
            {d.runError}
          </div>
        )}

        {status === "skipped" && (
          <div className="mt-2 rounded-md border border-dashed border-line px-2.5 py-2 text-[11px] leading-snug text-faint">
            {d.runError ?? "Skipped."}
          </div>
        )}
      </div>
    </div>
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

function OptionalParam({
  value,
  onChange,
  options,
  autoLabel,
  customPlaceholder,
  className = "",
}: {
  value?: string;
  onChange: (next?: string) => void;
  options: readonly { value: string; label: string }[];
  autoLabel: string;
  customPlaceholder?: string;
  className?: string;
}) {
  const [forceCustom, setForceCustom] = useState(false);
  const known = options.some((o) => o.value === value);
  const custom = forceCustom || (!!value && !known);
  const selectValue = custom ? CUSTOM_PARAM : (value ?? "");

  return (
    <div className={`min-w-0 ${className}`}>
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
        className="nodrag w-full rounded-md border border-line bg-sunken px-2 py-1.5 font-mono text-[10.5px] text-muted outline-none transition-colors focus:border-line2"
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
          className="nodrag mt-1 w-full rounded-md border border-accent/40 bg-sunken px-2 py-1.5 font-mono text-[10.5px] text-ink/85 outline-none transition-colors placeholder:text-faint focus:border-accent"
        />
      )}
    </div>
  );
}

function StatusMark({ status }: { status: string }) {
  if (status === "running")
    return <Spinner className="shrink-0 text-live" />;
  const color =
    status === "done"
      ? "var(--color-ok)"
      : status === "error"
        ? "var(--color-err)"
        : status === "queued"
          ? "var(--color-live)"
          : status === "skipped"
            ? "var(--color-faint)"
            : "var(--color-line2)";
  return (
    <span
      className="kun-dot h-1.5 w-1.5 shrink-0 rounded-full"
      style={{ background: color }}
      title={status}
    />
  );
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`kun-spin shrink-0 ${className}`}
      width="11"
      height="11"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
    >
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.6" />
      <path d="M6 1.5a4.5 4.5 0 0 1 4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
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
        className="nowheel mt-2 max-h-56 w-full rounded-md border border-line object-cover"
      />
    );
  if (kind === "audio")
    return (
      <audio
        controls
        preload="metadata"
        src={url.includes("?") ? `${url}&play=1` : `${url}?play=1`}
        className="nodrag mt-2 w-full"
      />
    );
  if (kind === "video")
    return (
      <video
        controls
        playsInline
        preload="metadata"
        src={url}
        className="nowheel mt-2 max-h-56 w-full rounded-md border border-line bg-black"
      />
    );
  return null;
}
