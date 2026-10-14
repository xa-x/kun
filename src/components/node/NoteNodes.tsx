"use client";

import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages";
import { NodeResizer, type NodeProps } from "@xyflow/react";
import { ArrowLineDown, Play, Trash } from "@phosphor-icons/react";
import { emitNode, patchNode } from "@/lib/node-events";
import type { FlowNodeData } from "@/lib/types";

type Tone = NonNullable<FlowNodeData["tone"]>;
const TONES: { id: Tone; label: MessageKey }[] = [
  { id: "sand", label: "canvas.tone.sand" },
  { id: "mint", label: "canvas.tone.mint" },
  { id: "sky", label: "canvas.tone.sky" },
  { id: "rose", label: "canvas.tone.rose" },
];

function ToneDots({ id, tone }: { id: string; tone: Tone }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label={t("canvas.tone.label")}>
      {TONES.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={tone === o.id}
          aria-label={t(o.label)}
          title={t(o.label)}
          onClick={(e) => {
            e.stopPropagation();
            patchNode(id, { tone: o.id });
          }}
          data-tone={o.id}
          className={`kun-tone-dot nodrag ${tone === o.id ? "is-on" : ""}`}
        />
      ))}
    </div>
  );
}

/**
 * A sticky note on the canvas. It has no ports and never runs: somewhere to
 * write what a step is for, what to try next, or why something was wired the
 * way it was.
 */
export function CommentNode({ id, data, selected }: NodeProps) {
  const { t } = useI18n();
  const d = data as FlowNodeData;
  const tone = d.tone ?? "sand";
  return (
    <div
      data-tone={tone}
      className={`kun-comment group w-[236px] ${selected ? "is-selected" : ""}`}
    >
      <div className="kun-comment__bar nodrag">
        <ToneDots id={id} tone={tone} />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            emitNode("kun:remove-node", id);
          }}
          title={t("canvas.comment.delete")}
          aria-label={t("canvas.comment.delete")}
          className="flex h-6 w-6 items-center justify-center rounded-full text-faint transition-colors hover:bg-ink/10 hover:text-ink"
        >
          <Trash size={12} weight="bold" aria-hidden />
        </button>
      </div>
      <textarea
        value={d.text ?? ""}
        onChange={(e) => patchNode(id, { text: e.target.value })}
        aria-label={t("canvas.node.comment.label")}
        placeholder={t("canvas.comment.placeholder")}
        dir="auto"
        rows={3}
        className="kun-comment__text nodrag nowheel"
      />
    </div>
  );
}

/**
 * A frame around some nodes. What is inside runs apart from the rest of the
 * project (Run group), and moves with the frame. Which nodes belong is kept on
 * the nodes themselves (`data.group`), so it survives saving and copying.
 */
export function GroupNode({ id, data, selected }: NodeProps) {
  const { t } = useI18n();
  const d = data as FlowNodeData;
  const tone = d.tone ?? "sky";
  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={220}
        minHeight={140}
        lineClassName="!border-ink/30"
        handleClassName="!h-2.5 !w-2.5 !rounded-full !border-ink/40 !bg-card"
        onResizeEnd={(_, p) => patchNode(id, { w: Math.round(p.width), h: Math.round(p.height) })}
      />
      <div
        data-tone={tone}
        className={`kun-group h-full w-full ${selected ? "is-selected" : ""}`}
      >
        <div className="kun-group__tab nodrag">
          <input
            // The default name is saved in English; show it in the active language.
            value={d.label === "Group" ? t("canvas.node.group.label") : (d.label ?? "")}
            onChange={(e) => patchNode(id, { label: e.target.value })}
            aria-label={t("canvas.group.name")}
            placeholder={t("canvas.node.group.label")}
            dir="auto"
            spellCheck={false}
            className="kun-group__name"
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              emitNode("kun:run-group", id);
            }}
            title={t("canvas.group.runTip")}
            className="kun-group__btn"
          >
            <Play size={11} weight="fill" aria-hidden />
            {t("canvas.group.run")}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              emitNode("kun:ungroup", id);
            }}
            title={t("canvas.group.ungroupTip")}
            aria-label={t("canvas.group.ungroup")}
            className="kun-group__btn !px-1.5"
          >
            <ArrowLineDown size={12} weight="bold" className="rotate-180" aria-hidden />
          </button>
          <ToneDots id={id} tone={tone} />
        </div>
      </div>
    </>
  );
}
