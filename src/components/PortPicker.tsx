"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { nodeDescription, nodeLabel } from "@/lib/i18n/nodes";
import { compatibleKinds, type PortType } from "@/lib/nodes";
import { NodeKindIcon } from "./node/icons";

export interface PortPick {
  nodeId: string;
  handle: string;
  side: "out" | "in";
  type: PortType;
  /** Where to open it, in screen pixels. */
  x: number;
  y: number;
}

const WIDTH = 264;

/**
 * Pops up beside an open port with the nodes that can connect to it. Picking
 * one adds it and wires it up. Opened from a port's "+" or by dropping a wire
 * on empty canvas.
 */
export function PortPicker({
  pick,
  onPick,
  onClose,
}: {
  pick: PortPick;
  onPick: (kind: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const options = compatibleKinds(pick.type, pick.side);
  const type = t(`editor.port.${pick.type}`);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    ref.current?.querySelector("button")?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Open away from the port, and never off the screen.
  const left = Math.max(
    8,
    Math.min(
      pick.side === "out" ? pick.x + 14 : pick.x - WIDTH - 14,
      window.innerWidth - WIDTH - 8,
    ),
  );
  const top = Math.max(8, Math.min(pick.y - 24, window.innerHeight - 80 - options.length * 52));

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={pick.side === "out" ? t("editor.portPicker.connectNew") : t("editor.portPicker.feedNew")}
      className="kun-pop fixed z-50 overflow-hidden rounded-2xl border border-line2 bg-raised p-1.5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl"
      style={{ left, top, width: WIDTH }}
    >
      <p className="px-2.5 pb-1.5 pt-1.5 text-[11.5px] text-faint">
        {pick.side === "out"
          ? t("editor.portPicker.connectTo", { type })
          : t("editor.portPicker.feedFrom", { type })}
      </p>
      {options.length === 0 && (
        <p className="px-2.5 pb-2.5 pt-1 text-[12.5px] leading-snug text-muted">
          {t("editor.portPicker.nothing", { type })}
        </p>
      )}
      {options.map((d) => (
        <button
          key={d.type}
          type="button"
          role="menuitem"
          onClick={() => onPick(d.type)}
          className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start transition-colors hover:bg-ink/6 focus-visible:bg-ink/6"
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ color: d.color, background: "color-mix(in srgb, currentColor 13%, transparent)" }}
          >
            <NodeKindIcon kind={d.type} />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-medium text-ink">{nodeLabel(t, d.type, d.label)}</span>
            <span className="block truncate text-[11.5px] text-muted">{nodeDescription(t, d.type, d.description)}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
