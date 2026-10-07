"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CaretDown,
  CaretLeft,
  ClockCounterClockwise,
  Export,
  GearSix,
  Play,
  Plus,
  ShareNetwork,
  Sparkle,
  Stop,
} from "@phosphor-icons/react";
import { Logomark } from "./Wordmark";
import { ago } from "@/lib/format";
import { APP_HOME } from "@/lib/routes";

interface Book {
  id: string;
  title: string;
  updatedAt?: string | number;
}

export function PlayBar({
  title,
  onTitle,
  running,
  onRun,
  onStop,
  onSave,
  saved,
  dirty,
  books,
  activeId,
  onOpen,
  onNew,
  onSettings,
  assistantOpen,
  onAssistant,
  runsOpen,
  onRuns,
  onShare,
  onPublish,
  costLabel,
  readOnly = false,
}: {
  title: string;
  onTitle: (t: string) => void;
  running: boolean;
  onRun: () => void;
  onStop: () => void;
  onSave: () => void;
  saved: string | null;
  dirty: boolean;
  books: Book[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  onSettings: () => void;
  assistantOpen?: boolean;
  onAssistant?: () => void;
  runsOpen?: boolean;
  onRuns?: () => void;
  onShare?: () => void;
  onPublish?: () => void;
  costLabel?: string | null;
  readOnly?: boolean;
}) {
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const status = running
    ? "Running"
    : dirty
      ? "Unsaved changes"
      : saved
        ? `Saved ${saved}`
        : "Saved";

  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-canvas/80 px-3 backdrop-blur-xl">
      <Link
        href={readOnly ? "/" : APP_HOME}
        title={readOnly ? "Kun" : "All workbooks"}
        className="flex h-9 items-center gap-1 rounded-full pl-1.5 pr-3 text-muted transition-colors hover:bg-ink/6 hover:text-ink"
      >
        <CaretLeft size={14} weight="bold" aria-hidden />
        <Logomark />
        <span className="sr-only">{readOnly ? "Kun" : "All workbooks"}</span>
      </Link>

      <div className="mx-1 h-5 w-px bg-line" aria-hidden />

      <div ref={menuRef} className="relative flex min-w-0 items-center">
        <input
          value={title}
          onChange={(e) => onTitle(e.target.value)}
          readOnly={readOnly}
          spellCheck={false}
          placeholder="Untitled"
          className="h-9 w-[clamp(120px,22vw,260px)] min-w-0 rounded-full border border-transparent bg-transparent px-3 text-[14px] font-medium text-ink outline-none transition-colors hover:border-line focus:border-line2 focus:bg-sunken"
          aria-label="Workbook title"
        />
        {!readOnly && (
          <button
            type="button"
            onClick={() => setMenu((v) => !v)}
            disabled={running}
            aria-haspopup="menu"
            aria-expanded={menu}
            aria-label="Switch workbook"
            title="Switch workbook"
            className="flex h-9 w-9 items-center justify-center rounded-full text-faint transition-colors hover:bg-ink/6 hover:text-ink disabled:opacity-40"
          >
            <CaretDown
              size={13}
              weight="bold"
              className={`transition-transform ${menu ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
        )}

        {menu && (
          <div
            role="menu"
            className="kun-pop absolute left-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-2xl border border-line2 bg-raised shadow-2xl shadow-black/40"
          >
            <p className="px-4 pb-1 pt-3 text-[12px] font-medium text-faint">
              Workbooks
            </p>
            <div className="max-h-72 overflow-auto px-1.5 pb-1.5">
              {books.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenu(false);
                    onOpen(b.id);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-ink/5 ${
                    b.id === activeId ? "bg-ink/[0.07]" : ""
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      b.id === activeId ? "bg-ink" : "bg-transparent"
                    }`}
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                    {b.title || "Untitled"}
                  </span>
                  <span className="shrink-0 text-[11.5px] text-faint">
                    {ago(b.updatedAt)}
                  </span>
                </button>
              ))}
              {!books.length && (
                <p className="px-2.5 py-3 text-[13px] text-faint">
                  Nothing saved yet.
                </p>
              )}
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenu(false);
                onNew();
              }}
              className="flex w-full items-center gap-2.5 border-t border-line px-4 py-3 text-left text-[13px] text-muted transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <Plus size={14} weight="bold" aria-hidden />
              New workbook
            </button>
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1">
        {costLabel && costLabel !== "—" && (
          <span
            className="mr-1 hidden font-mono text-[12px] tabular-nums text-muted md:block"
            title="Cost of the last run"
          >
            {costLabel}
          </span>
        )}
        <span
          className={`mr-2 hidden text-[12.5px] lg:block ${
            running ? "text-live" : dirty ? "text-warn" : "text-faint"
          }`}
          aria-live="polite"
        >
          {status}
        </span>
        {dirty && !running && !readOnly && (
          <button
            type="button"
            onClick={onSave}
            className="kun-btn-secondary mr-1 h-9 rounded-full px-4 text-[13px] font-medium"
          >
            Save
          </button>
        )}

        {onShare && (
          <BarButton onClick={onShare} label="Share" icon={<ShareNetwork size={16} aria-hidden />} />
        )}
        {onPublish && (
          <BarButton onClick={onPublish} label="Publish" icon={<Export size={16} aria-hidden />} />
        )}
        {onRuns && (
          <BarButton
            onClick={onRuns}
            label="Runs"
            active={runsOpen}
            icon={<ClockCounterClockwise size={16} aria-hidden />}
          />
        )}
        {onAssistant && (
          <BarButton
            onClick={onAssistant}
            label="Assistant"
            active={assistantOpen}
            icon={<Sparkle size={16} weight={assistantOpen ? "fill" : "regular"} aria-hidden />}
          />
        )}
        <button
          type="button"
          onClick={onSettings}
          disabled={running}
          title="Settings"
          aria-label="Settings"
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-ink/6 hover:text-ink disabled:opacity-40"
        >
          <GearSix size={17} aria-hidden />
        </button>

        <div className="ml-2">
          {running ? (
            <button
              type="button"
              onClick={onStop}
              className="flex h-9 items-center gap-2 rounded-full border border-live/50 bg-live/10 px-5 text-[13px] font-medium text-live transition-colors hover:bg-live/15"
            >
              <Stop size={12} weight="fill" aria-hidden />
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={onRun}
              className="kun-btn-primary flex h-9 items-center gap-2 rounded-full px-5 text-[13px] font-medium"
            >
              <Play size={12} weight="fill" aria-hidden />
              Run
            </button>
          )}
        </div>
      </div>

      {running && <span className="kun-progress" aria-hidden />}
    </header>
  );
}

function BarButton({
  label,
  icon,
  onClick,
  active = false,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={`flex h-9 items-center gap-2 rounded-full px-3 text-[13px] transition-colors ${
        active
          ? "bg-ink/10 text-ink"
          : "text-muted hover:bg-ink/6 hover:text-ink"
      }`}
    >
      {icon}
      <span className="hidden xl:inline">{label}</span>
      <span className="sr-only xl:hidden">{label}</span>
    </button>
  );
}
