"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { Copy, Play, Trash } from "@phosphor-icons/react";
import { nodeDef } from "@/lib/nodes";
import { NodeFrame, portPlacements } from "../node/NodeFrame";
import { PORT_COLOR } from "../node/tokens";

/**
 * A live preview of the product, built from the real node card. Nothing here
 * is a screenshot: the cards are the same <NodeFrame> the editor renders, the
 * wires use the editor's port geometry, and the picture is a generated image
 * that actually passes through the pipeline it depicts.
 */

// 960 of cards plus a gutter so ports, which sit half outside the card edge,
// are never clipped by the stage.
const STAGE_W = 976;
const STAGE_H = 664;
const NODE_W = 276;

type Id = "brief" | "image" | "video" | "caption";

const NODES: { id: Id; kind: string; x: number; y: number }[] = [
  { id: "brief", kind: "text", x: 0, y: 168 },
  { id: "image", kind: "image.gen", x: 372, y: 0 },
  { id: "video", kind: "video.gen", x: 684, y: 170 },
  { id: "caption", kind: "llm", x: 372, y: 400 },
];

const WIRES: {
  from: Id;
  to: Id;
  toPort: string;
  type: "text" | "image";
  live?: boolean;
}[] = [
  { from: "brief", to: "image", toPort: "prompt", type: "text" },
  { from: "brief", to: "caption", toPort: "in", type: "text" },
  { from: "image", to: "video", toPort: "image", type: "image", live: true },
];

function portY(id: Id, side: "in" | "out", portId?: string) {
  const node = NODES.find((n) => n.id === id)!;
  const def = nodeDef(node.kind)!;
  const { placements } = portPlacements(def);
  const p = placements.find(
    (x) => x.side === side && (portId ? x.port.id === portId : true),
  )!;
  return node.y + p.top;
}

function wirePath(from: Id, to: Id, toPort: string) {
  const a = NODES.find((n) => n.id === from)!;
  const b = NODES.find((n) => n.id === to)!;
  const x1 = a.x + NODE_W;
  const y1 = portY(from, "out");
  const x2 = b.x;
  const y2 = portY(to, "in", toPort);
  const dx = Math.max(56, (x2 - x1) / 2);
  return `M${x1} ${y1} C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`;
}

const SPRING = { type: "spring", stiffness: 90, damping: 18 } as const;

export function HeroCanvas() {
  const reduce = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);

  // Fit the fixed-size stage to its column; below ~540px it crops instead of
  // shrinking into illegibility, which reads as a canvas that keeps going.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () =>
      setScale(Math.min(1.1, Math.max(0.56, el.clientWidth / STAGE_W)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Same initial state on server and client (hydration must match); reduced
  // motion only makes the transition instant.
  const enter = (i: number) => ({
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: reduce
      ? { duration: 0 }
      : { ...SPRING, delay: 0.25 + i * 0.14 },
  });

  return (
    <LazyMotion features={domAnimation} strict>
      <div
        ref={wrap}
        role="img"
        aria-label="A canvas. A text brief feeds an AI image node, whose picture feeds an AI video node that is rendering. A second branch writes a caption."
        className="relative w-full overflow-hidden"
        style={{ height: STAGE_H * (scale ?? 0.8) }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left transition-opacity duration-500"
          style={{
            width: STAGE_W,
            height: STAGE_H,
            transform: `scale(${scale ?? 0.8})`,
            opacity: scale === null ? 0 : 1,
          }}
          aria-hidden
        >
          <svg
            className="absolute inset-0 overflow-visible"
            width={STAGE_W}
            height={STAGE_H}
          >
            {WIRES.map((w, i) => {
              const d = wirePath(w.from, w.to, w.toPort);
              const color = PORT_COLOR[w.type];
              return (
                <g key={`${w.from}-${w.to}`}>
                  <m.path
                    d={d}
                    className="kun-wire"
                    stroke={color}
                    strokeOpacity={0.85}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={
                      reduce
                        ? { duration: 0 }
                        : { duration: 0.9, delay: 0.7 + i * 0.18, ease: "easeOut" }
                    }
                  />
                  {w.live && (
                    <path
                      d={d}
                      className="kun-wire kun-wire-live"
                      stroke="var(--color-live)"
                      strokeWidth={2.4}
                    />
                  )}
                </g>
              );
            })}
          </svg>

          <m.div className="absolute" style={{ left: 0, top: 168 }} {...enter(0)}>
            <NodeFrame
              def={nodeDef("text")!}
              label="Brief"
              status="done"
              connected={{ in: new Set(), out: new Set(["out"]) }}
            >
              <div className="kun-field !h-[92px] overflow-hidden !cursor-default">
                A lighthouse on a dark headland at dusk. One window lit. Fog
                rolling over black rock.
              </div>
            </NodeFrame>
          </m.div>

          <m.div className="absolute" style={{ left: 372, top: 0 }} {...enter(1)}>
            <NodeFrame
              def={nodeDef("image.gen")!}
              label="Hero still"
              status="done"
              selected
              connected={{ in: new Set(["prompt"]), out: new Set(["out"]) }}
              toolbar={
                <div className="kun-node__toolbar">
                  <span className="kun-node__tool" data-tone="run">
                    <Play size={11} weight="fill" />
                    Run
                  </span>
                  <span className="kun-node__tool">
                    <Copy size={13} weight="bold" />
                  </span>
                  <span className="kun-node__tool">
                    <Trash size={13} weight="bold" />
                  </span>
                </div>
              }
            >
              <div className="space-y-2">
                <div className="kun-field !h-[58px] overflow-hidden !cursor-default">
                  Cinematic photograph, blue hour, long exposure, restrained
                  palette.
                </div>
                <div className="flex gap-1.5">
                  <span className="kun-chip-select">Seedream 5 Lite</span>
                  <span className="kun-chip-select">16:9</span>
                </div>
                <div className="kun-photo !rounded-xl aspect-video">
                  <Image
                    src="/landing/hero-lighthouse.jpg"
                    alt=""
                    fill
                    priority
                    sizes="252px"
                    className="object-cover"
                  />
                </div>
              </div>
            </NodeFrame>
          </m.div>

          <m.div className="absolute" style={{ left: 684, top: 170 }} {...enter(2)}>
            <NodeFrame
              def={nodeDef("video.gen")!}
              label="Slow push-in"
              status="running"
              connected={{ in: new Set(["image"]), out: new Set() }}
            >
              <div className="space-y-2">
                <div className="kun-field !h-[58px] overflow-hidden !cursor-default">
                  Slow push-in. Fog drifts across the rocks. The window
                  flickers.
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="kun-chip-select">Seedance 2.5</span>
                  <span className="kun-chip-select">5s</span>
                  <span className="kun-chip-select">16:9</span>
                </div>
                <div className="kun-photo !rounded-xl aspect-video">
                  <Image
                    src="/landing/hero-lighthouse.jpg"
                    alt=""
                    fill
                    sizes="252px"
                    className="origin-[70%_40%] scale-[1.35] object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2.5 pt-8">
                    <div className="flex items-center justify-between text-[11px] font-medium text-white/90">
                      <span>Rendering</span>
                      <span className="tabular-nums">62%</span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/20">
                      <div className="h-full w-[62%] rounded-full bg-[var(--color-live)]" />
                    </div>
                  </div>
                </div>
              </div>
            </NodeFrame>
          </m.div>

          <m.div className="absolute" style={{ left: 372, top: 400 }} {...enter(3)}>
            <NodeFrame
              def={nodeDef("llm")!}
              label="Caption"
              status="done"
              connected={{ in: new Set(["in"]), out: new Set() }}
            >
              <div className="space-y-2">
                <div className="kun-field !h-[34px] overflow-hidden !cursor-default">
                  Write a caption for the film.
                </div>
                <span className="kun-chip-select inline-block">
                  Claude Sonnet 4.5
                </span>
                <div className="rounded-xl border border-line bg-sunken px-3 py-2 text-[12px] leading-relaxed text-ink/85">
                  One window lit against the dark. Dusk on the northern
                  headland.
                </div>
              </div>
            </NodeFrame>
          </m.div>
        </div>
      </div>
    </LazyMotion>
  );
}
