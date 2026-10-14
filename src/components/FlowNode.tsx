"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Handle,
  Position,
  useStore,
  type NodeProps,
} from "@xyflow/react";
import {
  ArrowLineDown,
  Check,
  Copy,
  DownloadSimple,
  Play,
  PushPin,
  Snowflake,
  Trash,
  Images,
  UploadSimple,
  X,
} from "@phosphor-icons/react";
import { nodeDef, type NodeTypeDef } from "@/lib/nodes";
import { useI18n } from "@/lib/i18n";
import { portLabel } from "@/lib/i18n/nodes";
import {
  CUSTOM_MODEL,
  filterModels,
  groupModels,
  kindForNode,
  liveList,
  modelName,
  suggestionsFor,
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
import { parseTextOutput } from "@/lib/render";
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
import { MediaEmbed, OutputRenderer, downloadOutputs } from "./OutputRenderer";
import { SkillPicker } from "./SkillPicker";
import { toast } from "./Toast";
import { readJson } from "@/lib/http";
import { fmtUsd } from "@/lib/format";
import { useEstimate, useFormatEstimate } from "@/lib/use-estimates";
import { aspectNumber } from "@/lib/media-params";
import { NodeFrame, handleStyle, type PortPlacement } from "./node/NodeFrame";
import { PORT_TYPE_KEY } from "./node/tokens";
import { CommentNode, GroupNode } from "./node/NoteNodes";
import { MediaCard } from "./node/MediaCard";
import { NodeBadges } from "./node/NodeBadges";
import { PortAdd } from "./node/PortAdd";
import { AssetPicker } from "./assets/AssetPicker";
import type { AssetKind } from "@/lib/assets";

/** "47s", "4m 42s": how long a node ran. */
function fmtDuration(ms: number) {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

const patch = (nodeId: string, p: Record<string, unknown>) =>
  window.dispatchEvent(
    new CustomEvent("kun:update", { detail: { nodeId, patch: p } }),
  );

const emit = (name: string, nodeId: string) =>
  window.dispatchEvent(new CustomEvent(name, { detail: { nodeId } }));

/**
 * Every canvas node is a "flow" node. Comments and group frames are notes with
 * their own light cards; everything else is a standard node card.
 */
export function FlowNode(props: NodeProps) {
  const kind = (props.data as FlowNodeData).kind;
  if (kind === "comment") return <CommentNode {...props} />;
  if (kind === "group") return <GroupNode {...props} />;
  return <StandardNode {...props} />;
}

function StandardNode({ id, data, selected }: NodeProps) {
  const { t, tn } = useI18n();
  const fmtEstimate = useFormatEstimate();
  const d = data as FlowNodeData;
  const def = nodeDef(d.kind);
  const [upl, setUpl] = useState(false);
  const [picking, setPicking] = useState(false);
  const [more, setMore] = useState(false);
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

  const shortlist = suggestionsFor(cat, kindForNode(d.kind), def?.models);
  const defaultModel =
    recents.length || shortlist.length
      ? pickRecentDefault(
          recents,
          shortlist,
          cat.models,
          cat.errors,
          need,
        ).model
      : "";

  // What this model usually costs and how long it takes, shown before a run.
  const estimate = useEstimate(
    ["llm", "image.gen", "tts", "video.gen"].includes(d.kind)
      ? (d.model ?? defaultModel)
      : undefined,
  );

  useEffect(() => {
    if (d.kind !== "tts" || !d.voice) return;
    const modelId = d.model ?? defaultModel;
    const listed = voicesForModel(cat.models, modelId);
    if (!resolveVoice(modelId, d.voice, listed)) {
      patch(id, { voice: undefined });
    }
  }, [cat.models, defaultModel, d.kind, d.model, d.voice, id]);

  if (!def) return null;

  const isMediaIn = ["file.in", "image.in", "audio.in", "video.in"].includes(d.kind);
  const mediaKind =
    d.kind === "file.in" ? (d.mediaType ?? "image") : d.kind.replace(".in", "");
  const isSink = d.kind.startsWith("out.");
  const isAi = ["llm", "image.gen", "tts", "video.gen"].includes(d.kind);
  const isVisualAi = d.kind === "image.gen" || d.kind === "video.gen";
  const status = d.runStatus ?? "idle";
  const outputs = d.outputs ?? [];
  // The shape asked for: the chosen aspect (or exact size / resolution).
  const frameRatio = isVisualAi
    ? (aspectNumber(d.aspectRatio) ?? aspectNumber(d.size) ?? aspectNumber(d.resolution))
    : undefined;
  // live-streamed text (LLM nodes), shown while running
  const streaming = d.streamingText ?? "";
  const hasContent =
    outputs.some((o) => (o.type === "text" ? !!o.text.trim() : !!o.url)) ||
    (!!streaming && status === "running");
  // changing content replays the arrival animation
  const sig = JSON.stringify(
    outputs.map((o) => (o.type === "text" ? o.text.length : o.url)),
  );

  // A short caption for what an Output node received, in the active language.
  const describeOutputs = (outs: NodeOutput[]): string => {
    const texts = outs.filter(
      (o): o is Extract<NodeOutput, { type: "text" }> => o.type === "text",
    );
    const mediaCount = outs.length - texts.length;
    const parts: string[] = [];
    if (texts.length === 1) {
      const kinds = new Set(parseTextOutput(texts[0].text ?? "").map((b) => b.kind));
      const name = kinds.has("html")
        ? t("canvas.out.page")
        : kinds.has("json")
          ? t("canvas.out.json")
          : kinds.has("code")
            ? t("canvas.out.code")
            : kinds.has("image") || kinds.has("audio") || kinds.has("video")
              ? t("canvas.out.embed")
              : t("common.text");
      parts.push(`${name} · ${tn("canvas.result.chars", (texts[0].text ?? "").length)}`);
    } else if (texts.length > 1) parts.push(tn("canvas.out.texts", texts.length));
    if (mediaCount) parts.push(tn("canvas.out.mediaCount", mediaCount));
    return parts.join(" + ") || t("canvas.out.empty");
  };

  const upload = async (file: File) => {
    // A File node takes any media; remember which kind so the right port fires.
    const mediaType = (["image", "audio", "video"] as const).find((k) =>
      file.type.startsWith(`${k}/`),
    );
    if (d.kind === "file.in" && !mediaType) {
      toast(t("canvas.node.chooseMedia"), "error");
      return;
    }
    setUpl(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await readJson<{ id?: string; error?: string }>(res).catch(
        () => ({} as { id?: string; error?: string }),
      );
      if (!res.ok || !j.id) {
        const msg = typeof j.error === "string" ? j.error : t("canvas.node.uploadFailed");
        toast(msg, "error");
        patch(id, { runStatus: "error", runError: msg });
        return;
      }
      window.dispatchEvent(
        new CustomEvent("kun:set-artifact", {
          detail: { nodeId: id, artifactId: j.id, mediaType },
        }),
      );
      patch(id, { runStatus: undefined, runError: undefined });
    } catch {
      toast(t("canvas.node.uploadFailed"), "error");
      patch(id, { runStatus: "error", runError: t("canvas.node.uploadFailed") });
    } finally {
      setUpl(false);
    }
  };

  const copy = async (str: string) => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(str);
      ok = true;
    } catch {
      // fallback for contexts where the async clipboard API is blocked
      const ta = document.createElement("textarea");
      ta.value = str;
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
    <div className="kun-node__toolbar nodrag" role="toolbar" aria-label={t("canvas.toolbar.label")}>
      {status !== "running" && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            emit("kun:run-node", id);
          }}
          className="kun-node__tool"
          data-tone="run"
          title={t("canvas.toolbar.runTip")}
        >
          <Play size={11} weight="fill" aria-hidden />
          {t("common.run")}
        </button>
      )}
      {status !== "running" && connected.out.size > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            window.dispatchEvent(
              new CustomEvent("kun:run-node", {
                detail: { nodeId: id, mode: "from" },
              }),
            );
          }}
          className="kun-node__tool"
          title={t("canvas.toolbar.runFrom")}
          aria-label={t("canvas.toolbar.runFrom")}
        >
          <ArrowLineDown size={13} weight="bold" aria-hidden />
        </button>
      )}
      {isAi && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              patch(id, { frozen: !d.frozen });
            }}
            className="kun-node__tool"
            data-on={d.frozen ? "true" : undefined}
            aria-pressed={!!d.frozen}
            title={
              d.frozen
                ? t("canvas.toolbar.frozenTip")
                : t("canvas.toolbar.freezeTip")
            }
            aria-label={d.frozen ? t("canvas.toolbar.unfreeze") : t("canvas.toolbar.freeze")}
          >
            <Snowflake size={13} weight="bold" aria-hidden />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              patch(id, { pinned: !d.pinned });
            }}
            className="kun-node__tool"
            data-on={d.pinned ? "pin" : undefined}
            aria-pressed={!!d.pinned}
            title={
              d.pinned
                ? t("canvas.toolbar.pinnedTip")
                : t("canvas.toolbar.pinTip")
            }
            aria-label={d.pinned ? t("canvas.toolbar.unpin") : t("canvas.toolbar.pin")}
          >
            <PushPin size={13} weight={d.pinned ? "fill" : "bold"} aria-hidden />
          </button>
        </>
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
            title={t("canvas.toolbar.duplicate")}
            aria-label={t("canvas.toolbar.duplicate")}
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
            title={t("canvas.toolbar.delete")}
            aria-label={t("canvas.toolbar.delete")}
          >
            <Trash size={13} weight="bold" aria-hidden />
          </button>
        </>
      )}
    </div>
  );

  const renderHandle = (p: PortPlacement) => (
    <span key={`${p.side}-${p.port.id}`}>
      <Handle
        id={p.port.id}
        type={p.side === "in" ? "target" : "source"}
        position={p.side === "in" ? Position.Left : Position.Right}
        style={handleStyle(p)}
        title={t("canvas.portTip", { label: portLabel(t, p.port.label), type: t(PORT_TYPE_KEY[p.port.type]) })}
      />
      {!p.connected && (
        <PortAdd nodeId={id} port={p.port} side={p.side} top={p.top} />
      )}
    </span>
  );

  // Model and the settings that shape the result. Rarely used ones sit behind
  // "+". A skill or standing instruction is an Instruction node wired into the
  // prompt port, never a setting here.
  const controls =
    def.models && def.models.length > 0 ? (

            <div className="flex flex-wrap items-center gap-1.5">
              <ModelPicker
                id={id}
                d={d}
                def={def}
                defaultModel={defaultModel}
                recents={recents}
                live={live}
              />

              {d.kind === "image.gen" && (
                <AspectParam
                  value={d.aspectRatio}
                  options={IMAGE_ASPECTS}
                  onChange={(aspectRatio) =>
                    patch(id, { aspectRatio, size: undefined })
                  }
                />
              )}

              {d.kind === "video.gen" && (
                <>
                  <AspectParam
                    value={d.aspectRatio}
                    options={VIDEO_ASPECTS}
                    onChange={(aspectRatio) => patch(id, { aspectRatio })}
                  />
                  <OptionalParam
                    value={d.duration != null ? String(d.duration) : undefined}
                    onChange={(raw) =>
                      patch(id, {
                        duration: raw ? Number(raw) || undefined : undefined,
                      })
                    }
                    options={VIDEO_DURATIONS}
                    autoLabel={t("canvas.param.length")}
                    customPlaceholder={t("canvas.param.seconds")}
                  />
                </>
              )}

              {d.kind === "tts" && (
                <OptionalParam
                  value={d.voice}
                  onChange={(voice) => patch(id, { voice })}
                  options={voiceChoices(
                    d.model ?? defaultModel,
                    voicesForModel(cat.models, d.model ?? defaultModel),
                  )}
                  autoLabel={t("canvas.param.voice")}
                  customPlaceholder={t("canvas.param.voicePh")}
                />
              )}

              {(d.kind === "image.gen" || d.kind === "video.gen") &&
                (more || d.size || d.resolution ? (
                  d.kind === "image.gen" ? (
                    <OptionalParam
                      value={d.size}
                      onChange={(size) =>
                        patch(id, { size, aspectRatio: size ? undefined : d.aspectRatio })
                      }
                      options={IMAGE_SIZES}
                      autoLabel={t("canvas.param.size")}
                      customPlaceholder="1024x1024"
                    />
                  ) : (
                    <OptionalParam
                      value={d.resolution}
                      onChange={(resolution) => patch(id, { resolution })}
                      options={VIDEO_RESOLUTIONS}
                      autoLabel={t("canvas.param.resolution")}
                      customPlaceholder="1920x1080"
                    />
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => setMore(true)}
                    title={d.kind === "image.gen" ? t("canvas.param.moreSize") : t("canvas.param.moreResolution")}
                    aria-label={t("canvas.param.more")}
                    className="nodrag kun-chip-select !px-2 leading-none"
                  >
                    +
                  </button>
                ))}
            </div>
    ) : null;

  if (d.kind === "image.gen" || d.kind === "video.gen" || d.kind === "tts") {
    const effModel = d.model ?? defaultModel;
    const listed = (live ?? []).find((m) => m.id === effModel);
    const modelLabel = listed ? modelName(listed) : (effModel.split("/").pop() ?? t("canvas.model.pick"));
    const summary = [
      d.kind === "tts" ? d.voice : (d.aspectRatio ?? d.size),
      d.kind === "video.gen" && d.duration ? `${d.duration}s` : null,
      d.kind === "video.gen" ? d.resolution : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return (
      <MediaCard
        nodeId={id}
        kind={d.kind}
        status={status}
        selected={selected}
        connected={connected}
        ports={{ in: def.inputs, out: def.outputs }}
        result={outputs}
        requestedRatio={frameRatio}
        modelLabel={modelLabel}
        summary={summary}
        controls={controls}
        error={d.runError}
        startedAt={d.runStartedAt}
        cost={
          d.runUsage?.costUsd
            ? d.runDurationMs
              ? `${fmtUsd(d.runUsage.costUsd)} · ${fmtDuration(d.runDurationMs)}`
              : fmtUsd(d.runUsage.costUsd)
            : null
        }
        estimate={estimate ? fmtEstimate(estimate) : null}
        toolbar={toolbar}
        seed={id}
        frozen={!!d.frozen}
        pinned={!!d.pinned}
      />
    );
  }

  return (
    <NodeFrame
      def={def}
      label={d.label}
      status={status}
      selected={selected}
      wide={isSink}
      cost={
        d.runUsage?.costUsd
          ? d.runDurationMs
            ? `${fmtUsd(d.runUsage.costUsd)} · ${fmtDuration(d.runDurationMs)}`
            : fmtUsd(d.runUsage.costUsd)
          : null
      }
      estimate={estimate ? fmtEstimate(estimate) : null}
      startedAt={d.runStartedAt}
      frozen={!!d.frozen}
      badges={<NodeBadges frozen={d.frozen} pinned={d.pinned} />}
      connected={connected}
      renderHandle={renderHandle}
      toolbar={toolbar}
    >
      <div className="space-y-2">
        {/* source editors */}
        {(d.kind === "note" || (d.kind === "text" && d.skillId)) && (
          <SkillPicker
            compact
            value={d.skillId}
            draft={{ displayName: d.label, body: d.text }}
            onPick={(skill) =>
              patch(
                id,
                skill
                  ? {
                      skillId: skill.slug,
                      label: skill.displayName,
                      text: skill.instructions ?? skill.body ?? "",
                    }
                  : { skillId: undefined },
              )
            }
          />
        )}

        {(d.kind === "text" || d.kind === "note") && (
          <textarea
            value={d.text ?? ""}
            onChange={(e) => patch(id, { text: e.target.value })}
            aria-label={d.kind === "note" ? t("canvas.node.note.label") : t("canvas.node.text.label")}
            placeholder={
              d.kind === "note" ? t("canvas.node.instructionPh") : t("canvas.node.textPh")
            }
            dir="auto"
            rows={d.kind === "note" ? 2 : 5}
            className="kun-field nodrag nowheel resize-y"
          />
        )}

        {d.kind === "llm" && (
          <textarea
            value={d.prompt ?? ""}
            onChange={(e) => patch(id, { prompt: e.target.value })}
            aria-label={t("canvas.port.prompt")}
            placeholder={t("canvas.node.llmPh")}
            dir="auto"
            rows={3}
            className="kun-field nodrag nowheel resize-y"
          />
        )}

        {controls}

        {/* media input */}
        {isMediaIn && (
          <div className="nodrag flex gap-2">
          <label
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed bg-sunken px-3 py-3 text-[12px] transition-colors ${
              upl
                ? "border-live/50 text-live"
                : "border-line2 text-muted hover:border-ink/40 hover:text-ink"
            }`}
          >
            <UploadSimple size={14} weight="bold" aria-hidden />
            {upl ? t("common.uploading") : d.artifactId ? t("canvas.node.replaceFile") : t("canvas.node.chooseFile")}
            <input
              type="file"
              accept={
                d.kind === "file.in"
                  ? "image/*,audio/*,video/*"
                  : d.kind === "image.in"
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
          <button
            type="button"
            onClick={() => setPicking(true)}
            disabled={upl}
            title={t("canvas.node.assetsTip")}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-line2 bg-sunken px-3 text-[12px] text-muted transition-colors hover:border-ink/40 hover:text-ink disabled:opacity-50"
          >
            <Images size={14} aria-hidden />
            {t("canvas.node.assets")}
          </button>
          </div>
        )}
        {picking && (
          <AssetPicker
            accept={d.kind === "file.in" ? ["image", "audio", "video"] : [mediaKind as AssetKind]}
            onClose={() => setPicking(false)}
            onPick={(a) => {
              setPicking(false);
              window.dispatchEvent(
                new CustomEvent("kun:set-artifact", {
                  detail: { nodeId: id, artifactId: a.id, mediaType: a.kind },
                }),
              );
              patch(id, { runStatus: undefined, runError: undefined });
            }}
          />
        )}
        {isMediaIn && d.artifactId && !upl && (
          <MediaPreview
            url={`/api/media/${d.artifactId}`}
            kind={mediaKind}
          />
        )}

        {/* Latest result of an AI node, so a graph reads at a glance. */}
        {d.kind === "llm" && (hasContent || status === "running") && (
          <TextResult
            outputs={outputs}
            streaming={status === "running" ? streaming : ""}
            running={status === "running"}
            copied={copied}
            onCopy={copy}
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
                    ? t("canvas.node.streaming")
                    : describeOutputs(outputs)}
                </span>
                <div className="flex items-center gap-1">
                  {outputs.some((o) =>
                    o.type !== "text" ? !!o.url : !!o.text?.trim(),
                  ) && (
                    <button
                      type="button"
                      onClick={() => downloadOutputs(outputs)}
                      title={t("canvas.node.downloadOutput")}
                      className="nodrag kun-node__tool"
                    >
                      <DownloadSimple size={13} weight="bold" aria-hidden />
                      {t("common.save")}
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
                    title={t("canvas.node.copyRaw")}
                    className="nodrag kun-node__tool"
                  >
                    {copied ? (
                      <Check size={13} weight="bold" aria-hidden />
                    ) : (
                      <Copy size={13} weight="bold" aria-hidden />
                    )}
                    {copied ? t("common.copied") : t("common.copy")}
                  </button>
                </div>
              </div>
              {status === "running" && streaming ? (
                <pre dir="auto" className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-line bg-sunken px-3 py-2.5 font-mono text-[11px] leading-relaxed text-ink/85">
                  {streaming}
                  <span className="kun-caret" aria-hidden />
                </pre>
              ) : (
                <ResultGallery outputs={outputs} />
              )}
            </div>
          ) : status === "running" || status === "queued" ? (
            <div className="flex items-center gap-2 py-3 text-[12px] text-faint">
              <span className="kun-eq text-live" aria-hidden>
                <span />
                <span />
                <span />
              </span>
              {t("canvas.node.waiting")}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-line2 px-3 py-5 text-center">
              <p className="text-[12.5px] text-muted">{t("canvas.node.wireHere")}</p>
              <p className="mx-auto mt-0.5 max-w-[22ch] text-[11.5px] leading-snug text-faint">
                {t("canvas.node.wireHereBody")}
              </p>
            </div>
          ))}

        {status === "error" && (
          <div dir="auto" className="rounded-xl border border-err/40 bg-err/10 px-3 py-2 text-[11.5px] leading-snug text-err">
            {d.runError}
          </div>
        )}

        {status === "skipped" && (
          <div className="rounded-xl border border-dashed border-line2 px-3 py-2 text-[11.5px] leading-snug text-faint">
            {d.runError ?? t("canvas.node.skipped")}
          </div>
        )}
      </div>
    </NodeFrame>
  );
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
  const { t } = useI18n();
  const cat = useCatalog();
  const [customModel, setCustomModel] = useState(false);

  const need = kindForNode(d.kind);
  const suggested = suggestionsFor(cat, need, def.models);
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
    t("canvas.model.recent"),
    recents.map((r) => ({
      id: r.id,
      label:
        r.label ??
        liveById.get(r.id) ??
        suggested.find((s) => s.id === r.id)?.label ??
        r.id,
    })),
  );

  addGroup("suggested", t("canvas.model.suggested"), suggested);

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
  const orGone = t("canvas.model.retired");
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
      <div className="relative basis-full">
        <input
          value={d.model ?? ""}
          onChange={(e) => patch(id, { model: e.target.value })}
          autoComplete="off"
          spellCheck={false}
          aria-label={t("canvas.model.customId")}
          dir="ltr"
          placeholder={
            orphanGateway
              ? t("canvas.model.gatewayOffline")
              : t("canvas.model.customPh")
          }
          title={
            orphanGateway
              ? t("canvas.model.gatewayTip")
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
            title={t("canvas.model.backToPresets")}
            aria-label={t("canvas.model.backToPresets")}
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
      aria-label={t("canvas.model.label")}
      className="kun-chip-select nodrag w-auto"
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
      <option value={CUSTOM_MODEL}>{t("canvas.model.custom")}</option>
    </select>
  );
}

/**
 * What an Output node received, laid out to be read at a glance: text first,
 * pictures and clips side by side, sound as a slim player. Stacking them at
 * full width made a node taller than the screen.
 */
function ResultGallery({ outputs }: { outputs: NodeOutput[] }) {
  const shown = outputs.filter((o) =>
    o.type === "text" ? !!o.text.trim() : !!o.url,
  );
  const texts = shown.filter((o) => o.type === "text");
  const visuals = shown.filter((o) => o.type === "image" || o.type === "video");
  const sounds = shown.filter((o) => o.type === "audio");
  return (
    <div className="space-y-2">
      {texts.map((o, i) => (
        <div key={`t${i}`} dir="auto">
          <OutputRenderer output={o} />
        </div>
      ))}
      {visuals.length > 0 && (
        <div className={visuals.length > 1 ? "grid grid-cols-2 gap-2" : ""}>
          {visuals.map((o, i) => (
            <OutputRenderer key={`v${i}`} output={o} />
          ))}
        </div>
      )}
      {sounds.map((o, i) => (
        <OutputRenderer key={`a${i}`} output={o} />
      ))}
    </div>
  );
}

/**
 * A text node's whole result, rendered the way an Output node used to: prose,
 * code, JSON or a live page, with copy and save beside it. While it is being
 * written the text streams in.
 */
function TextResult({
  outputs,
  streaming,
  running,
  copied,
  onCopy,
}: {
  outputs: NodeOutput[];
  streaming: string;
  running: boolean;
  copied: boolean;
  onCopy: (text: string) => void;
}) {
  const { t, tn } = useI18n();
  const text = outputs
    .filter((o): o is Extract<NodeOutput, { type: "text" }> => o.type === "text")
    .map((o) => o.text)
    .join("\n\n")
    .trim();

  if (running && streaming) {
    return (
      <pre dir="auto" className="kun-rise nowheel max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-line bg-sunken px-3 py-2.5 font-mono text-[11px] leading-relaxed text-ink/85">
        {streaming}
        <span className="kun-caret" aria-hidden />
      </pre>
    );
  }
  if (!text) return null;

  return (
    <div className="kun-rise space-y-1.5">
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[11px] text-faint">{tn("canvas.result.chars", text.length)}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => downloadOutputs(outputs)}
            title={t("canvas.node.downloadResult")}
            className="nodrag kun-node__tool"
          >
            <DownloadSimple size={13} weight="bold" aria-hidden />
            {t("common.save")}
          </button>
          <button
            type="button"
            onClick={() => onCopy(text)}
            title={t("canvas.node.copyResult")}
            className="nodrag kun-node__tool"
          >
            {copied ? (
              <Check size={13} weight="bold" aria-hidden />
            ) : (
              <Copy size={13} weight="bold" aria-hidden />
            )}
            {copied ? t("common.copied") : t("common.copy")}
          </button>
        </div>
      </div>
      <div dir="auto">
        <OutputRenderer output={{ type: "text", text }} />
      </div>
    </div>
  );
}

function OptionalParam({
  value,
  onChange,
  options,
  autoLabel,
  customPlaceholder,
  glyph,
}: {
  glyph?: React.ReactNode;
  value?: string;
  onChange: (next?: string) => void;
  options: readonly { value: string; label: string }[];
  autoLabel: string;
  customPlaceholder?: string;
}) {
  const { t } = useI18n();
  const [forceCustom, setForceCustom] = useState(false);
  const known = options.some((o) => o.value === value);
  const custom = forceCustom || (!!value && !known);
  const selectValue = custom ? CUSTOM_PARAM : (value ?? "");

  return (
    <div className="relative min-w-0">
      {glyph && (
        <span className="pointer-events-none absolute left-2.5 top-1/2 flex -translate-y-1/2 items-center text-muted">
          {glyph}
        </span>
      )}
      <select
        value={selectValue}
        aria-label={autoLabel}
        style={glyph ? { paddingLeft: "1.75rem" } : undefined}
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
        <option value={CUSTOM_PARAM}>{t("canvas.param.custom")}</option>
      </select>
      {custom && (
        <input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value.trim() || undefined)}
          spellCheck={false}
          placeholder={customPlaceholder}
          aria-label={t("canvas.param.customOf", { label: autoLabel })}
          className="kun-field nodrag mt-1 font-mono text-[11px]"
        />
      )}
    </div>
  );
}

/** A little rectangle in the chosen shape, so an aspect reads at a glance. */
function AspectGlyph({ ratio }: { ratio?: number }) {
  const r = ratio ?? 1.4;
  const w = r >= 1 ? 12 : Math.round(12 * r);
  const h = r >= 1 ? Math.round(12 / r) : 12;
  return (
    <span
      aria-hidden
      style={{ width: w, height: h }}
      className={`block rounded-[2px] border border-current ${ratio ? "" : "border-dashed"}`}
    />
  );
}

/** Aspect picker: the shape drawn beside its label, "Aspect" when unset. */
function AspectParam({
  value,
  options,
  onChange,
}: {
  value?: string;
  options: readonly { value: string; label: string }[];
  onChange: (next?: string) => void;
}) {
  const { t } = useI18n();
  return (
    <OptionalParam
      value={value}
      onChange={onChange}
      options={options}
      autoLabel={t("canvas.param.aspect")}
      customPlaceholder={t("canvas.param.aspectPh")}
      glyph={<AspectGlyph ratio={aspectNumber(value)} />}
    />
  );
}

function MediaPreview({ url, kind }: { url: string; kind: string }) {
  if (!url) return null;
  return <MediaEmbed kind={kind} src={url} />;
}
