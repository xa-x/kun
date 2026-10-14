"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";
import {
  CaretDown,
  Check,
  DownloadSimple,
  Pause,
  Play,
  WarningCircle,
} from "@phosphor-icons/react";
import type { PortDef } from "@/lib/nodes";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages";
import { portLabel } from "@/lib/i18n/nodes";
import type { NodeOutput, RunStatus } from "@/lib/types";
import { peaksOf, standInPeaks } from "@/lib/waveform";
import { downloadHref, filenameFor, playableSrc } from "../OutputRenderer";
import { Elapsed } from "./Elapsed";
import { NodeKindIcon } from "./icons";
import { NodeBadges } from "./NodeBadges";
import { handleStyle, type PortPlacement } from "./NodeFrame";
import { PORT_TYPE_KEY } from "./tokens";
import { PortAdd, openPortPicker } from "./PortAdd";

type Kind = "image.gen" | "video.gen" | "tts";

const TYPE_LABEL: Record<Kind, MessageKey> = {
  "image.gen": "common.image",
  "video.gen": "common.video",
  tts: "canvas.mcard.speech",
};

/** Stage geometry, in canvas pixels. */
const STAGE_W = 320; // width of a landscape or square stage
const STAGE_MAX_H = 340; // tallest a portrait stage grows
const CARD_MIN_W = 216; // room for the top bar
const BAR_H = 40;
const AUDIO_H = 104;

const DEFAULT_RATIO: Record<Kind, number> = {
  "image.gen": 1,
  "video.gen": 16 / 9,
  tts: 1,
};

/** The stage that holds a picture of shape `r`: wide ones wide, tall ones tall. */
export function stageSize(r: number): { w: number; h: number } {
  const h = Math.min(STAGE_MAX_H, Math.round(STAGE_W / r));
  return { w: Math.round(h * r), h };
}

function AudioStage({
  src,
  live,
  seed,
}: {
  src?: string;
  live: boolean;
  seed: string;
}) {
  const { t } = useI18n();
  const BARS = 44;
  const [peaks, setPeaks] = useState(() => standInPeaks(seed, BARS));
  const [time, setTime] = useState({ t: 0, d: 0 });
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);

  // The real shape of the sound, when the browser can decode it.
  useEffect(() => {
    if (!src) return;
    let alive = true;
    (async () => {
      try {
        const buf = await (await fetch(playableSrc(src))).arrayBuffer();
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        const decoded = await ctx.decodeAudioData(buf.slice(0));
        void ctx.close();
        if (alive) setPeaks(peaksOf(decoded.getChannelData(0), BARS));
      } catch {
        /* keep the stand-in */
      }
    })();
    return () => {
      alive = false;
    };
  }, [src]);

  const frac = time.d ? time.t / time.d : 0;
  const mmss = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div className="flex h-full items-center gap-3 px-3.5">
      {src && !live ? (
        <>
          <button
            type="button"
            onClick={() => {
              const a = audio.current;
              if (!a) return;
              if (a.paused) void a.play();
              else a.pause();
            }}
            aria-label={playing ? t("canvas.audio.pause") : t("canvas.audio.play")}
            className="nodrag flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-canvas transition-transform active:scale-[0.94]"
          >
            {playing ? (
              <Pause size={14} weight="fill" aria-hidden />
            ) : (
              <Play size={14} weight="fill" aria-hidden />
            )}
          </button>
          <audio
            ref={audio}
            src={playableSrc(src)}
            preload="metadata"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onTimeUpdate={(e) =>
              setTime({ t: e.currentTarget.currentTime, d: e.currentTarget.duration || 0 })
            }
            onLoadedMetadata={(e) =>
              setTime({ t: 0, d: e.currentTarget.duration || 0 })
            }
          />
        </>
      ) : null}
      <div
        className="nodrag flex h-12 flex-1 cursor-pointer items-center gap-[2px]"
        onClick={(e) => {
          const a = audio.current;
          if (!a || !time.d) return;
          const r = e.currentTarget.getBoundingClientRect();
          a.currentTime = ((e.clientX - r.left) / r.width) * time.d;
        }}
        role="presentation"
      >
        {peaks.map((p, i) => (
          <span
            key={i}
            className={`kun-wavebar ${live ? "is-live" : i / BARS <= frac && frac > 0 ? "is-played" : ""}`}
            style={{
              height: `${Math.round(p * 100)}%`,
              ["--d" as string]: `${(i % 11) * 0.09}s`,
            }}
          />
        ))}
      </div>
      {src && !live && (
        <span className="w-[4.2ch] shrink-0 text-right font-mono text-[11px] tabular-nums text-muted">
          {mmss(playing || time.t ? time.t : time.d)}
        </span>
      )}
    </div>
  );
}

/**
 * Image, video and speech nodes: no text box, just the work. A slim bar names
 * the model and opens its settings; below it the card is the media itself and
 * takes its shape, wide, tall or square. While a result is being made a soft
 * blur breathes where it will appear. Inputs sit on the left edge, the result
 * leaves from the right.
 */
export function MediaCard({
  nodeId,
  kind,
  status,
  selected,
  connected,
  ports,
  result,
  requestedRatio,
  modelLabel,
  summary,
  controls,
  error,
  startedAt,
  cost,
  estimate,
  toolbar,
  seed,
  frozen = false,
  pinned = false,
}: {
  nodeId: string;
  kind: Kind;
  status: RunStatus;
  selected: boolean;
  connected: { in: Set<string>; out: Set<string> };
  ports: { in: PortDef[]; out: PortDef[] };
  result: NodeOutput[];
  /** Shape asked for (aspect, size or resolution), if any. */
  requestedRatio?: number;
  modelLabel: string;
  /** "16:9 · 4s": the settings in a few characters. */
  summary: string;
  /** Model and settings selectors, shown under the bar when it is opened. */
  controls: ReactNode;
  error?: string;
  startedAt?: number;
  cost?: string | null;
  estimate?: string | null;
  toolbar: ReactNode;
  /** Keeps the stand-in waveform stable per node. */
  seed: string;
  frozen?: boolean;
  pinned?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const shell = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!shell.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const media = result.find(
    (o): o is Exclude<NodeOutput, { type: "text" }> =>
      o.type !== "text" && !!o.url,
  );
  const busy = status === "running" || status === "queued";
  const isAudio = kind === "tts";

  // The stage takes the shape of what came back, else of what was asked for.
  const [measured, setMeasured] = useState<{ url: string; r: number } | null>(null);
  const known = media?.url && measured?.url === media.url ? measured.r : undefined;
  const ratio = known ?? requestedRatio ?? DEFAULT_RATIO[kind];
  const stage = isAudio ? { w: STAGE_W, h: AUDIO_H } : stageSize(ratio);
  const width = Math.max(stage.w, CARD_MIN_W);

  // Inputs spread down the left edge of the stage; the result leaves the right.
  const rail = (n: number, i: number) => BAR_H + (stage.h * (i + 1)) / (n + 1);
  const placements: PortPlacement[] = [
    ...ports.in.map((port, i) => ({
      port,
      side: "in" as const,
      top: rail(ports.in.length, i),
      connected: connected.in.has(port.id),
    })),
    ...ports.out.map((port, i) => ({
      port,
      side: "out" as const,
      top: rail(ports.out.length, i),
      connected: connected.out.has(port.id),
    })),
  ];

  const promptWired = ports.in.some(
    (p) => p.type === "text" && connected.in.has(p.id),
  );

  return (
    <div
      ref={shell}
      data-kind={kind}
      style={{ width }}
      className={`kun-node kun-media-card group st-${status} ${selected ? "is-selected" : ""} ${frozen ? "is-frozen" : ""}`}
    >
      {toolbar}

      <header className="kun-mcard__bar">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
          style={{ color: "var(--gen)", background: "color-mix(in srgb, var(--gen) 14%, transparent)" }}
        >
          <NodeKindIcon kind={kind} />
        </span>
        <span className="shrink-0 text-[12.5px] font-medium text-ink">
          {t(TYPE_LABEL[kind])}
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="dialog"
          title={t("canvas.mcard.modelSettings")}
          className="kun-mcard__model nodrag min-w-0"
        >
          <span dir="ltr" className="truncate text-muted">{modelLabel}</span>
          <CaretDown size={10} weight="bold" className={`shrink-0 text-faint transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
        <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[10.5px] text-faint">
          <NodeBadges frozen={frozen} pinned={pinned} />
          {busy ? (
            <span className="flex items-center gap-1 font-medium text-live">
              {startedAt ? <Elapsed since={startedAt} /> : t("canvas.status.queued")}
            </span>
          ) : cost ? (
            <span className="font-mono" title={t("canvas.frame.nodeCost")}>{cost}</span>
          ) : estimate ? (
            <span className="font-mono" title={t("canvas.frame.estimateTip")}>{estimate}</span>
          ) : null}
          {status === "done" && (
            <Check size={12} weight="bold" className="text-ok" aria-label={t("canvas.status.done")} />
          )}
          {status === "error" && (
            <WarningCircle size={13} weight="bold" className="text-err" aria-label={t("canvas.status.failed")} />
          )}
        </span>
      </header>

      {open && (
        <div role="dialog" aria-label={t("canvas.mcard.modelSettings")} className="kun-mcard__config kun-pop nodrag nowheel">
          {controls}
        </div>
      )}

      <div
        className="kun-mcard__stage group/stage"
        style={{ height: stage.h, width: "100%" }}
      >
        <div
          className="absolute left-1/2 top-0 -translate-x-1/2"
          style={{ width: isAudio ? "100%" : stage.w, height: stage.h }}
        >
          {/* A finished result, blurred while a new one is made. */}
          {media && !isAudio && (
            <div className="absolute inset-0 overflow-hidden">
              {media.type === "video" ? (
                <video
                  src={media.url}
                  controls={!busy}
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={(e) => {
                    const { videoWidth: w, videoHeight: h } = e.currentTarget;
                    if (w && h && media.url) setMeasured({ url: media.url, r: w / h });
                  }}
                  className={`nowheel nodrag h-full w-full bg-black object-contain ${busy ? "kun-genblur" : ""}`}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={media.url}
                  alt=""
                  onLoad={(e) => {
                    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
                    if (w && h && media.url) setMeasured({ url: media.url, r: w / h });
                  }}
                  className={`h-full w-full object-contain ${busy ? "kun-genblur" : ""}`}
                />
              )}
            </div>
          )}

          {isAudio && (
            <AudioStage
              src={media?.url}
              live={busy}
              seed={seed}
            />
          )}

          {/* Being made, with nothing to blur yet. */}
          {busy && !media && !isAudio && (
            <div className="kun-genpulse" aria-hidden>
              <i />
              <i />
            </div>
          )}
          {busy && !isAudio && (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
              <span className="rounded-full bg-black/45 px-3 py-1 text-[11px] font-medium text-white/90 backdrop-blur">
                {t("canvas.mcard.generating")}
              </span>
            </div>
          )}

          {/* Nothing yet. */}
          {!busy && !media && status !== "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 border border-dashed border-line2 text-center">
              <span className="text-[12px] text-muted">
                {promptWired ? t("canvas.mcard.readyRun") : t("canvas.mcard.connectPrompt")}
              </span>
              <span className="max-w-[24ch] text-[11px] leading-snug text-faint">
                {promptWired
                  ? t("canvas.mcard.resultHere")
                  : t("canvas.mcard.wireText")}
              </span>
            </div>
          )}

          {status === "error" && !busy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-err/10 px-5 text-center">
              <WarningCircle size={18} weight="bold" className="text-err" aria-hidden />
              <p dir="auto" className="line-clamp-5 text-[11.5px] leading-snug text-err">
                {error || t("canvas.mcard.failedFallback")}
              </p>
            </div>
          )}

          {/* Settings in a few characters, and a way to keep the file. */}
          {summary && !busy && (
            <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-black/45 px-2.5 py-0.5 font-mono text-[10.5px] text-white/85 opacity-80 backdrop-blur transition-opacity group-hover/stage:opacity-100">
              {summary}
            </span>
          )}
          {media?.url && !busy && (
            <a
              href={downloadHref(media.url)}
              download={filenameFor(media.type, media.url)}
              title={t("common.download")}
              aria-label={t("common.download")}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white/90 opacity-0 backdrop-blur transition-opacity hover:bg-black/75 focus-visible:opacity-100 group-hover/stage:opacity-100"
            >
              <DownloadSimple size={14} weight="bold" aria-hidden />
            </a>
          )}
        </div>
      </div>

      {/* Ports: inputs on the left edge, the result on the right. Unwired
          inputs are named so it is clear what to connect. */}
      {placements.map((p) => (
        <span key={`${p.side}-${p.port.id}`}>
          <Handle
            id={p.port.id}
            type={p.side === "in" ? "target" : "source"}
            position={p.side === "in" ? Position.Left : Position.Right}
            style={handleStyle(p)}
            title={t("canvas.portTip", { label: portLabel(t, p.port.label), type: t(PORT_TYPE_KEY[p.port.type]) })}
          />
          {p.side === "in" ? (
            // An open input is a button that says what it takes; a wired one
            // shows its name only on hover.
            p.connected ? (
              <span
                className="pointer-events-none absolute right-full mr-3.5 -translate-y-1/2 whitespace-nowrap rounded-full bg-raised/90 px-2 py-0.5 text-[10.5px] text-muted opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"
                style={{ top: p.top }}
              >
                {portLabel(t, p.port.label)}
              </span>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openPortPicker(nodeId, p.port, "in", e.currentTarget);
                }}
                title={t("canvas.port.addBefore", { label: portLabel(t, p.port.label) })}
                aria-label={t("canvas.port.addBefore", { label: portLabel(t, p.port.label) })}
                className="nodrag nopan absolute right-full mr-3.5 flex -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-full border border-line2 bg-raised/95 py-0.5 pl-1.5 pr-2 text-[10.5px] text-muted backdrop-blur transition-colors hover:border-ink/40 hover:text-ink"
                style={{ top: p.top }}
              >
                <span aria-hidden className="text-[12px] leading-none">+</span>
                {portLabel(t, p.port.label)}
              </button>
            )
          ) : (
            <>
              {!p.connected && (
                <PortAdd nodeId={nodeId} port={p.port} side="out" top={p.top} />
              )}
            </>
          )}
        </span>
      ))}
    </div>
  );
}
