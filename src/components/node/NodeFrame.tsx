import type { CSSProperties, ReactNode } from "react";
import { Check, CircleNotch, Clock, WarningCircle } from "@phosphor-icons/react";
import type { NodeTypeDef, PortDef } from "@/lib/nodes";
import type { RunStatus } from "@/lib/types";
import { NodeKindIcon } from "./icons";
import { PORT_COLOR, PORT_NAME } from "./tokens";

/**
 * The card chrome shared by every node: icon chip + title, a rail of typed
 * ports, and a body slot. It is purely presentational (no React Flow, no
 * fetching) so the canvas node and the marketing preview render the exact
 * same card. The canvas supplies real <Handle>s through `renderHandle`.
 */

export const HEADER_H = 44;
export const ROW_H = 28;
export const RAIL_PAD = 4;
export const HANDLE = 12;

export type PortSide = "in" | "out";

export interface PortPlacement {
  port: PortDef;
  side: PortSide;
  /** Y of the port centre, relative to the card's top edge. */
  top: number;
  connected: boolean;
}

export interface ConnectedPorts {
  in: ReadonlySet<string>;
  out: ReadonlySet<string>;
}

const NONE: ConnectedPorts = { in: new Set(), out: new Set() };

/** Where each port sits on the card edges. */
export function portPlacements(
  def: NodeTypeDef,
  connected: ConnectedPorts = NONE,
): { placements: PortPlacement[]; railHeight: number } {
  const manyOut = def.outputs.length > 1;
  const rows = Math.max(def.inputs.length, manyOut ? def.outputs.length : 0);
  const rowCenter = (i: number) => HEADER_H + RAIL_PAD + i * ROW_H + ROW_H / 2;
  const placements: PortPlacement[] = [
    ...def.inputs.map((port, i) => ({
      port,
      side: "in" as const,
      top: rowCenter(i),
      connected: connected.in.has(port.id),
    })),
    ...def.outputs.map((port, i) => ({
      port,
      side: "out" as const,
      // A lone output lines up with the first input (or the title).
      top: manyOut ? rowCenter(i) : def.inputs.length ? rowCenter(0) : HEADER_H / 2,
      connected: connected.out.has(port.id),
    })),
  ];
  return { placements, railHeight: rows ? RAIL_PAD * 2 + rows * ROW_H : 0 };
}

/** Inline style for a port dot: hollow when free, filled when wired. */
export function handleStyle(p: PortPlacement): CSSProperties {
  const color = PORT_COLOR[p.port.type];
  return {
    position: "absolute",
    top: p.top - HANDLE / 2,
    [p.side === "in" ? "left" : "right"]: -(HANDLE / 2) - 1,
    width: HANDLE,
    height: HANDLE,
    background: p.connected ? color : "var(--color-card)",
    borderColor: p.connected ? "var(--color-card)" : color,
    borderWidth: 2,
    borderStyle: "solid",
    borderRadius: 999,
  };
}

export function NodeFrame({
  def,
  label,
  status = "idle",
  selected = false,
  cost,
  wide = false,
  connected,
  renderHandle,
  toolbar,
  children,
}: {
  def: NodeTypeDef;
  label?: string;
  status?: RunStatus;
  selected?: boolean;
  cost?: string | null;
  wide?: boolean;
  connected?: ConnectedPorts;
  /** Canvas passes React Flow handles; static previews get plain dots. */
  renderHandle?: (p: PortPlacement) => ReactNode;
  toolbar?: ReactNode;
  children?: ReactNode;
}) {
  const { placements, railHeight } = portPlacements(def, connected);
  const showLabel = (p: PortPlacement) =>
    p.side === "in" || def.outputs.length > 1;

  return (
    <div
      className={`kun-node group ${wide ? "w-[348px]" : "w-[276px]"} st-${status} ${selected ? "is-selected" : ""}`}
      style={{ "--node-accent": def.color } as CSSProperties}
    >
      {status === "running" && <span className="kun-shimmer" />}
      {toolbar}

      <header
        className="flex items-center gap-2.5 px-3"
        style={{ height: HEADER_H }}
      >
        <span className="kun-node__chip">
          <NodeKindIcon kind={def.type} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
          {label || def.label}
        </span>
        {cost ? (
          <span className="font-mono text-[10px] text-faint" title="Node cost">
            {cost}
          </span>
        ) : null}
        <StatusBadge status={status} />
      </header>

      {railHeight > 0 && (
        <div className="relative" style={{ height: railHeight }} aria-hidden>
          {placements.filter(showLabel).map((p) => (
            <span
              key={`${p.side}-${p.port.id}`}
              className={`pointer-events-none absolute flex h-4 items-center text-[11px] text-muted ${
                p.side === "in" ? "left-4" : "right-4"
              }`}
              style={{ top: p.top - HEADER_H - 8 }}
            >
              {p.port.label}
            </span>
          ))}
        </div>
      )}

      {placements.map((p) =>
        renderHandle ? (
          renderHandle(p)
        ) : (
          <span
            key={`${p.side}-${p.port.id}`}
            style={handleStyle(p)}
            title={`${p.port.label} (${PORT_NAME[p.port.type]})`}
          />
        ),
      )}

      <div className="px-3 pb-3 pt-1">{children}</div>
    </div>
  );
}

export function StatusBadge({ status }: { status: RunStatus }) {
  if (status === "running")
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium text-live">
        <CircleNotch size={12} weight="bold" className="kun-spin" aria-hidden />
        Running
      </span>
    );
  if (status === "queued")
    return (
      <span className="flex items-center gap-1 text-[11px] text-muted">
        <Clock size={12} weight="bold" aria-hidden />
        Queued
      </span>
    );
  if (status === "done")
    return (
      <span
        className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-ok/15 text-ok"
        title="Done"
      >
        <Check size={11} weight="bold" aria-label="Done" />
      </span>
    );
  if (status === "error")
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium text-err">
        <WarningCircle size={13} weight="bold" aria-hidden />
        Failed
      </span>
    );
  if (status === "skipped")
    return <span className="text-[11px] text-faint">Skipped</span>;
  return null;
}
