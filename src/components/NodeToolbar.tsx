"use client";

import { useRef } from "react";
import { Cursor, NotePencil, SelectionPlus } from "@phosphor-icons/react";
import { nodeDef } from "@/lib/nodes";
import { useI18n } from "@/lib/i18n";
import { nodeLabel } from "@/lib/i18n/nodes";
import { NodeKindIcon } from "./node/icons";
import { DND_MIME } from "./Palette";

/** The nodes in the toolbar, in order, each with its number key. */
export const TOOLBAR_NODES = [
  "text",
  "note",
  "file.in",
  "llm",
  "image.gen",
  "tts",
  "video.gen",
] as const;

/** Key -> node kind for 1..7, plus C for a comment. */
export const NODE_KEYS: Record<string, string> = {
  ...Object.fromEntries(TOOLBAR_NODES.map((k, i) => [String(i + 1), k])),
  c: "comment",
};

function Tip({ label, keys }: { label: string; keys: string }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute start-full top-1/2 z-10 ms-3 flex -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-lg border border-line2 bg-raised px-2 py-1 text-[11.5px] text-ink opacity-0 shadow-lg transition-opacity group-hover/tool:opacity-100 group-focus-visible/tool:opacity-100"
    >
      {label}
      <kbd className="rounded bg-ink/10 px-1 font-mono text-[10px] text-muted">{keys}</kbd>
    </span>
  );
}

function ToolButton({
  label,
  keys,
  onClick,
  children,
  active = false,
  disabled = false,
  dragType,
}: {
  label: string;
  keys: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  /** Node kind to drag onto the canvas. */
  dragType?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`${label} (${keys})`}
      aria-pressed={active || undefined}
      draggable={!!dragType && !disabled}
      onDragStart={(e) => {
        if (!dragType) return;
        e.dataTransfer.setData(DND_MIME, dragType);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`group/tool relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:translate-x-0.5 rtl:hover:-translate-x-0.5 hover:bg-ink/8 active:scale-[0.94] disabled:pointer-events-none disabled:opacity-35 ${
        active ? "bg-ink/12 text-ink" : "text-muted hover:text-ink"
      }`}
    >
      {children}
      <Tip label={label} keys={keys} />
    </button>
  );
}

const Sep = () => <span className="my-1 h-px w-6 shrink-0 bg-line" aria-hidden />;

/**
 * A tool rail down the left of the canvas: pick a node, a comment or a
 * group. Click to drop it in the middle of the view, or drag it to a spot.
 * Numbers 1-7 and C do the same from the keyboard. There is no Output node:
 * every node shows its own result.
 */
export function NodeToolbar({
  onAdd,
  onGroup,
  onSelect,
  selectedCount,
}: {
  onAdd: (kind: string) => void;
  onGroup: () => void;
  onSelect: () => void;
  selectedCount: number;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="pointer-events-none absolute bottom-[76px] start-3 top-[76px] z-20 flex items-center">
    <div
      ref={ref}
      role="toolbar"
      aria-label={t("editor.nodeBar.addToCanvas")}
      aria-orientation="vertical"
      className="kun-pop kun-rail pointer-events-auto flex flex-col items-center gap-0.5 rounded-[20px] border border-line2 bg-raised/90 p-1.5 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.7)] backdrop-blur-xl"
    >
      <ToolButton label={t("editor.nodeBar.select")} keys="V" onClick={onSelect} active>
        <Cursor size={18} weight="fill" aria-hidden />
      </ToolButton>
      <Sep />
      {TOOLBAR_NODES.map((kind, i) => {
        const def = nodeDef(kind);
        if (!def) return null;
        // A little gap between the families: inputs, then models.
        const edge = kind === "llm";
        return (
          <span key={kind} className="flex flex-col items-center gap-0.5">
            {edge && <Sep />}
            <ToolButton
              label={nodeLabel(t, kind, def.label)}
              keys={String(i + 1)}
              onClick={() => onAdd(kind)}
              dragType={kind}
            >
              <span style={{ color: def.color }} className="flex">
                <NodeKindIcon kind={kind} />
              </span>
            </ToolButton>
          </span>
        );
      })}
      <Sep />
      <ToolButton
        label={nodeLabel(t, "comment", "Comment")}
        keys="C"
        onClick={() => onAdd("comment")}
        dragType="comment"
      >
        <NotePencil size={18} weight="bold" aria-hidden />
      </ToolButton>
      <ToolButton
        label={
          selectedCount > 0
            ? t("editor.nodeBar.groupSelected", { n: selectedCount })
            : t("editor.nodeBar.groupHint")
        }
        keys="⌘G"
        onClick={onGroup}
        disabled={selectedCount < 1}
      >
        <SelectionPlus size={18} weight="bold" aria-hidden />
      </ToolButton>
    </div>
    </div>
  );
}
