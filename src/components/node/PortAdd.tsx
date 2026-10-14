"use client";

import { useI18n } from "@/lib/i18n";
import { portLabel } from "@/lib/i18n/nodes";
import { Plus } from "@phosphor-icons/react";
import type { PortDef } from "@/lib/nodes";
import { emitNode } from "@/lib/node-events";

/** Ask the canvas to open the node picker beside a port (see PortPicker). */
export function openPortPicker(
  nodeId: string,
  port: PortDef,
  side: "out" | "in",
  from: Element,
) {
  const r = from.getBoundingClientRect();
  emitNode("kun:port-add", nodeId, {
    handle: port.id,
    side,
    type: port.type,
    x: side === "out" ? r.right : r.left,
    y: r.top + r.height / 2,
  });
}

/**
 * The "+" beside a port that nothing is wired to: the quickest way to
 * continue a pipeline. An open output shows it softly all the time; an open
 * input shows it when the node is hovered.
 */
export function PortAdd({
  nodeId,
  port,
  side,
  top,
}: {
  nodeId: string;
  port: PortDef;
  side: "out" | "in";
  top: number;
}) {
  const { t } = useI18n();
  const label = portLabel(t, port.label);
  return (
    <button
      type="button"
      aria-label={
        side === "out"
          ? t("canvas.port.addAfter", { label })
          : t("canvas.port.addBefore", { label })
      }
      title={side === "out" ? t("canvas.port.addAfterTip") : t("canvas.port.addBeforeTip")}
      onClick={(e) => {
        e.stopPropagation();
        openPortPicker(nodeId, port, side, e.currentTarget);
      }}
      style={{ top: top - 10 }}
      className={`nodrag nopan absolute z-10 flex h-5 w-5 items-center justify-center rounded-full border border-line2 bg-raised text-muted shadow-sm transition-all hover:scale-110 hover:border-ink/50 hover:text-ink focus-visible:opacity-100 ${
        side === "out"
          ? "left-full ml-2.5 opacity-60 group-hover:opacity-100"
          : "right-full mr-2.5 opacity-0 group-hover:opacity-100"
      }`}
    >
      <Plus size={11} weight="bold" aria-hidden />
    </button>
  );
}
