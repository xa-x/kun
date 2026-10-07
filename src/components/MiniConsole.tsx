"use client";

import { useEffect, useRef } from "react";
import { CaretDown, CaretUp, Terminal } from "@phosphor-icons/react";
import { fmtUsd } from "@/lib/format";

export interface ConsoleLine {
  seq: number;
  type: string;
  level: string;
  nodeId?: string | null;
  status?: string;
  message?: string;
  ts: number;
}

export function MiniConsole({
  lines,
  runId,
  costUsd,
  collapsed,
  onToggle,
}: {
  lines: ConsoleLine[];
  runId?: string | null;
  costUsd?: number | null;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (collapsed) return;
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [lines.length, collapsed]);

  const cost = fmtUsd(costUsd);

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-line2 bg-raised/95 shadow-xl shadow-black/30 backdrop-blur">
      <button
        type="button"
        onClick={onToggle}
        disabled={!onToggle}
        aria-expanded={!collapsed}
        className="flex h-9 items-center justify-between gap-2 px-3.5 text-left text-[12px] text-muted transition-colors hover:text-ink"
      >
        <span className="flex items-center gap-2 font-medium">
          <Terminal size={14} weight="bold" aria-hidden />
          Console
        </span>
        <span className="flex items-center gap-2.5">
          {cost !== "—" && (
            <span className="font-mono tabular-nums text-ink">{cost}</span>
          )}
          {runId && (
            <span className="font-mono text-[11px] text-faint">
              {runId.slice(0, 8)}
            </span>
          )}
          {collapsed ? (
            <CaretUp size={12} weight="bold" aria-hidden />
          ) : (
            <CaretDown size={12} weight="bold" aria-hidden />
          )}
        </span>
      </button>
      {!collapsed && (
        <div
          ref={ref}
          className="max-h-44 min-h-0 flex-1 overflow-auto border-t border-line px-3.5 py-2 font-mono text-[11px]"
        >
          {!lines.length && (
            <p className="py-1 text-faint">Run events will stream in here.</p>
          )}
          {lines.map((l) => (
            <div
              key={`${l.seq}-${l.ts}`}
              className={`flex gap-2.5 py-0.5 ${
                l.level === "error"
                  ? "text-err"
                  : l.status === "running"
                    ? "text-live"
                    : "text-muted"
              }`}
            >
              <span className="shrink-0 tabular-nums text-faint">
                {new Date(l.ts).toLocaleTimeString()}
              </span>
              <span className="shrink-0">{l.type}</span>
              <span className="min-w-0 truncate">
                {l.nodeId ?? ""}
                {l.status ? ` ${l.status}` : ""}
                {l.message ? ` ${l.message}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
