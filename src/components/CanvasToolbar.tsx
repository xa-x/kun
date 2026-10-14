"use client";

import { useStore, useReactFlow } from "@xyflow/react";
import { useI18n } from "@/lib/i18n";
import { ArrowsOut, MapTrifold, Minus, Plus, TreeStructure } from "@phosphor-icons/react";

/**
 * One pill along the foot of the canvas for everything that acts on the view:
 * zoom, fit, arrange and the minimap. The left edge belongs to the node tools.
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
  const { t, num } = useI18n();
  const rf = useReactFlow();
  const zoom = useStore((s) => Math.round(s.transform[2] * 100));

  const btn =
    "flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-ink/8 hover:text-ink active:scale-[0.94]";

  return (
    <div
      role="toolbar"
      aria-label={t("editor.view.label")}
      className="flex items-center gap-0.5 rounded-[18px] border border-line2 bg-raised/90 p-1 shadow-[0_14px_32px_-16px_rgba(0,0,0,0.7)] backdrop-blur-xl"
    >
      <button
        type="button"
        className={btn}
        onClick={() => void rf.zoomOut({ duration: 150 })}
        aria-label={t("editor.view.zoomOut")}
        title={t("editor.view.zoomOut")}
      >
        <Minus size={14} weight="bold" aria-hidden />
      </button>

      <button
        type="button"
        onClick={() => void rf.zoomTo(1, { duration: 150 })}
        title={t("editor.view.resetTitle")}
        aria-label={t("editor.view.zoomAria", { n: num(zoom) })}
        dir="ltr"
        className="h-8 w-12 rounded-lg font-mono text-[11.5px] tabular-nums text-ink transition-colors hover:bg-ink/8"
      >
        {num(zoom)}%
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => void rf.zoomIn({ duration: 150 })}
        aria-label={t("editor.view.zoomIn")}
        title={t("editor.view.zoomIn")}
      >
        <Plus size={14} weight="bold" aria-hidden />
      </button>
      <span className="mx-1 h-5 w-px bg-line2" aria-hidden />

      <button
        type="button"
        className={btn}
        onClick={() => void rf.fitView({ padding: 0.22, maxZoom: 1, duration: 250 })}
        aria-label={t("editor.view.fit")}
        title={t("editor.view.fit")}
      >
        <ArrowsOut size={15} aria-hidden />
      </button>
      {!readOnly && (
        <button
          type="button"
          className={btn}
          onClick={onArrange}
          aria-label={t("editor.view.arrange")}
          title={t("editor.view.arrange")}
        >
          <TreeStructure size={15} aria-hidden />
        </button>
      )}
      <button
        type="button"
        onClick={onToggleMinimap}
        aria-pressed={minimap}
        aria-label={minimap ? t("editor.view.hideMinimap") : t("editor.view.showMinimap")}
        title={minimap ? t("editor.view.hideMinimap") : t("editor.view.showMinimap")}
        className={`${btn} ${minimap ? "!bg-ink/10 !text-ink" : ""}`}
      >
        <MapTrifold size={15} aria-hidden />
      </button>
    </div>
  );
}
