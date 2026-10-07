"use client";

import { useMemo, useState } from "react";
import { MagnifyingGlass, Plus, SidebarSimple } from "@phosphor-icons/react";
import type { NodeTypeDef } from "@/lib/nodes";
import { NodeKindIcon } from "./node/icons";

const GROUPS: { key: NodeTypeDef["category"]; label: string }[] = [
  { key: "input", label: "Inputs" },
  { key: "ai", label: "AI models" },
  { key: "output", label: "Outputs" },
];

export const DND_MIME = "application/x-kun-node";

/**
 * Node library. Click to add at the centre of the canvas, or drag onto an
 * exact spot. It stays closed so the canvas is never covered on load, opens
 * by itself on an empty workbook, and closes again once you have added a
 * node.
 */
export function Palette({
  onAdd,
  defs,
  emptyCanvas = false,
}: {
  onAdd: (type: string) => void;
  defs: NodeTypeDef[];
  emptyCanvas?: boolean;
}) {
  // null means "follow the canvas": open while it is empty, closed once it
  // has nodes. Any explicit choice by the user wins from then on.
  const [manual, setManual] = useState<boolean | null>(null);
  const open = manual ?? emptyCanvas;
  const [q, setQ] = useState("");

  const toggle = (next: boolean) => {
    setManual(next);
    if (!next) setQ("");
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return defs;
    return defs.filter(
      (d) =>
        d.label.toLowerCase().includes(needle) ||
        d.description.toLowerCase().includes(needle),
    );
  }, [defs, q]);

  if (!open)
    return (
      <button
        type="button"
        onClick={() => toggle(true)}
        className="kun-pop absolute left-3 top-3 z-10 flex h-10 items-center gap-2 rounded-full border border-line2 bg-raised/95 pl-3.5 pr-4 text-[13px] font-medium text-ink shadow-xl shadow-black/30 backdrop-blur transition-colors hover:border-ink/40"
      >
        <Plus size={14} weight="bold" aria-hidden />
        Add node
      </button>
    );

  return (
    <aside
      aria-label="Node library"
      className="kun-pop absolute bottom-16 left-3 top-3 z-10 flex w-[264px] select-none flex-col overflow-hidden rounded-2xl border border-line2 bg-raised/95 shadow-xl shadow-black/30 backdrop-blur"
    >
      <div className="flex items-center gap-2 p-2.5">
        <div className="relative min-w-0 flex-1">
          <MagnifyingGlass
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
            aria-hidden
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search nodes"
            aria-label="Search nodes"
            className="kun-field !rounded-full !py-1.5 pl-9"
          />
        </div>
        <button
          type="button"
          onClick={() => toggle(false)}
          aria-label="Hide node library"
          title="Hide"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-faint transition-colors hover:bg-ink/8 hover:text-ink"
        >
          <SidebarSimple size={16} aria-hidden />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
        {GROUPS.map((g) => {
          const items = filtered.filter((d) => d.category === g.key);
          if (!items.length) return null;
          return (
            <section key={g.key} className="mb-1.5">
              <h3 className="px-2.5 pb-1 pt-2 text-[11.5px] font-medium text-faint">
                {g.label}
              </h3>
              <ul>
                {items.map((d) => (
                  <li key={d.type}>
                    <button
                      type="button"
                      onClick={() => {
                        onAdd(d.type);
                        toggle(false);
                      }}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DND_MIME, d.type);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => toggle(false)}
                      title={d.description}
                      className="group flex w-full cursor-grab items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-ink/[0.06] active:cursor-grabbing"
                    >
                      <span
                        className="kun-node__chip"
                        style={{ ["--node-accent" as string]: d.color }}
                      >
                        <NodeKindIcon kind={d.type} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-ink">
                          {d.label}
                        </span>
                        <span className="block truncate text-[11.5px] text-faint">
                          {d.description}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {!filtered.length && (
          <p className="px-3 py-6 text-center text-[13px] text-faint">
            No node matches “{q}”.
          </p>
        )}
      </div>

      <p className="border-t border-line px-4 py-2.5 text-[12px] leading-snug text-faint">
        Click to add, or drag onto the canvas.
      </p>
    </aside>
  );
}
