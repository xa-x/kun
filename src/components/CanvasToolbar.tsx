"use client";

import { useStore, useReactFlow } from "@xyflow/react";
import { ArrowsOut, MapTrifold, Minus, Plus, TreeStructure } from "@phosphor-icons/react";

/**
 * One tidy pill for everything that acts on the view: zoom, fit, arrange and
 * the minimap. It replaces the stock React Flow controls and the scattered
 * top-right buttons.
 */
export function CanvasToolbar({
  onArrange,
  minimap,
  onToggleMinimap,
  readOnly = false,
}: {
  onArrange: () => void;
  minimap: boolean;
  onToggleMinimap: () => void;
  readOnly?: boolean;
}) {
  const rf = useReactFlow();
  const zoom = useStore((s) => Math.round(s.transform[2] * 100));

  const btn =
    "flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-ink/8 hover:text-ink";

  return (
    <div
      role="toolbar"
      aria-label="Canvas view"
      className="flex items-center gap-0.5 rounded-full border border-line2 bg-raised/95 p-1 shadow-xl shadow-black/30 backdrop-blur"
    >
      <button
        type="button"
        className={btn}
        onClick={() => void rf.zoomOut({ duration: 150 })}
        aria-label="Zoom out"
        title="Zoom out"
      >
        <Minus size={14} weight="bold" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => void rf.zoomTo(1, { duration: 150 })}
        title="Reset to 100%"
        aria-label={`Zoom ${zoom} percent. Reset to 100 percent`}
        className="h-8 min-w-[48px] rounded-full px-1 font-mono text-[12px] tabular-nums text-ink transition-colors hover:bg-ink/8"
      >
        {zoom}%
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => void rf.zoomIn({ duration: 150 })}
        aria-label="Zoom in"
        title="Zoom in"
      >
        <Plus size={14} weight="bold" aria-hidden />
      </button>

      <span className="mx-1 h-4 w-px bg-line2" aria-hidden />

      <button
        type="button"
        className={btn}
        onClick={() => void rf.fitView({ padding: 0.22, maxZoom: 1, duration: 250 })}
        aria-label="Fit to screen"
        title="Fit to screen"
      >
        <ArrowsOut size={15} aria-hidden />
      </button>
      {!readOnly && (
        <button
          type="button"
          className={btn}
          onClick={onArrange}
          aria-label="Arrange nodes"
          title="Arrange nodes"
        >
          <TreeStructure size={15} aria-hidden />
        </button>
      )}
      <button
        type="button"
        onClick={onToggleMinimap}
        aria-pressed={minimap}
        aria-label={minimap ? "Hide minimap" : "Show minimap"}
        title={minimap ? "Hide minimap" : "Show minimap"}
        className={`${btn} ${minimap ? "!bg-ink/10 !text-ink" : ""}`}
      >
        <MapTrifold size={15} aria-hidden />
      </button>
    </div>
  );
}
