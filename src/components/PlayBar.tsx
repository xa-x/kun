"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CaretDown,
  CaretLeft,
  ClockCounterClockwise,
  Export,
  GearSix,
  Lightning,
  Link as Link2,
  Play,
  Plus,
  ShareNetwork,
  Sparkle,
  Stop,
} from "@phosphor-icons/react";
import { Logomark } from "./Wordmark";
import { useI18n } from "@/lib/i18n";
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
  automateOpen,
  onAutomate,
  onShare,
  onPublish,
  costLabel,
  runHint,
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
  automateOpen?: boolean;
  onAutomate?: () => void;
  onShare?: () => void;
  onPublish?: () => void;
  costLabel?: string | null;
  /** "~$0.94 · ~6 min": what a full run typically costs, shown on Run. */
  runHint?: string | null;
  readOnly?: boolean;
}) {
  const { t } = useI18n();
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
    ? t("editor.play.running")
    : dirty
      ? t("editor.play.unsaved")
      : saved
        ? t("editor.play.savedAt", { when: saved })
        : t("common.saved");

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-3">
      {/* Where you are: back, the project, and whether it is saved. */}
      <div className="kun-pop pointer-events-auto flex min-w-0 items-center gap-0.5 rounded-[20px] border border-line2 bg-raised/90 p-1.5 shadow-[0_14px_32px_-16px_rgba(0,0,0,0.7)] backdrop-blur-xl">
        <Link
          href={readOnly ? "/" : APP_HOME}
          title={readOnly ? "Kun" : t("editor.play.allProjects")}
          className="flex h-9 shrink-0 items-center gap-1 rounded-xl ps-1.5 pe-2.5 text-muted transition-colors hover:bg-ink/8 hover:text-ink"
        >
          <CaretLeft size={14} weight="bold" className="rtl-flip" aria-hidden />
          <Logomark />
          <span className="sr-only">{readOnly ? "Kun" : t("editor.play.allProjects")}</span>
        </Link>

        <div ref={menuRef} className="relative flex min-w-0 items-center">
          <input
            value={title}
            onChange={(e) => onTitle(e.target.value)}
            readOnly={readOnly}
            spellCheck={false}
            placeholder={t("common.untitled")}
            dir="auto"
            className="h-9 w-[clamp(96px,20vw,240px)] min-w-0 rounded-xl border border-transparent bg-transparent px-2.5 text-[14px] font-medium text-ink outline-none transition-colors hover:bg-ink/5 focus:bg-sunken"
            aria-label={t("editor.play.projectTitle")}
          />
          {!readOnly && (
            <button
              type="button"
              onClick={() => setMenu((v) => !v)}
              disabled={running}
              aria-haspopup="menu"
              aria-expanded={menu}
              aria-label={t("editor.play.switchProject")}
              title={t("editor.play.switchProject")}
              className="flex h-9 w-8 items-center justify-center rounded-xl text-faint transition-colors hover:bg-ink/8 hover:text-ink disabled:opacity-40"
            >
              <CaretDown
                size={13}
                weight="bold"
                className={`transition-transform ${menu ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
          )}
          {menu && <ProjectMenu books={books} activeId={activeId} onOpen={(id) => { setMenu(false); onOpen(id); }} onNew={() => { setMenu(false); onNew(); }} />}
        </div>

        {/* One slot for state: saving beats the status line when there is
            something to save. */}
        {dirty && !running && !readOnly ? (
          <button
            type="button"
            onClick={onSave}
            className="ms-0.5 flex h-8 shrink-0 items-center rounded-full bg-warn/15 px-3 text-[12px] font-medium text-warn transition-colors hover:bg-warn/25"
          >
            {t("common.save")}
          </button>
        ) : (
          <span
            className={`ms-1 me-1.5 hidden shrink-0 items-center gap-1.5 text-[12px] sm:flex ${
              running ? "text-live" : "text-faint"
            }`}
            aria-live="polite"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${running ? "animate-pulse bg-live" : "bg-ok"}`}
              aria-hidden
            />
            {status}
          </span>
        )}
      </div>

      <div className="pointer-events-auto flex shrink-0 items-center gap-2">
        {!readOnly && (
          <div
            role="toolbar"
            aria-label={t("editor.play.tools")}
            className="kun-pop flex items-center gap-0.5 rounded-[20px] border border-line2 bg-raised/90 p-1.5 shadow-[0_14px_32px_-16px_rgba(0,0,0,0.7)] backdrop-blur-xl"
          >
            {onAssistant && (
              <BarButton
                onClick={onAssistant}
                label={t("editor.play.assistant")}
                active={assistantOpen}
                icon={<Sparkle size={16} weight={assistantOpen ? "fill" : "regular"} aria-hidden />}
              />
            )}
            {onRuns && (
              <BarButton
                onClick={onRuns}
                label={t("editor.play.runs")}
                active={runsOpen}
                icon={<ClockCounterClockwise size={16} aria-hidden />}
              />
            )}
            {onAutomate && (
              <BarButton
                onClick={onAutomate}
                label={t("editor.play.automate")}
                active={automateOpen}
                icon={<Lightning size={16} weight={automateOpen ? "fill" : "regular"} aria-hidden />}
              />
            )}
            {(onShare || onPublish) && (
              <ShareMenu onShare={onShare} onPublish={onPublish} />
            )}
            <button
              type="button"
              onClick={onSettings}
              disabled={running}
              title={t("common.settings")}
              aria-label={t("common.settings")}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-ink/8 hover:text-ink disabled:opacity-40"
            >
              <GearSix size={16} aria-hidden />
            </button>
          </div>
        )}

        {costLabel && costLabel !== "—" && !running && (
          <span
            className="hidden font-mono text-[12px] tabular-nums text-muted xl:block"
            title={t("editor.play.costTitle")}
          >
            {costLabel}
          </span>
        )}

        {/* The one bright thing on the screen. */}
        {running ? (
          <button
            type="button"
            onClick={onStop}
            className="kun-pop flex h-12 items-center gap-2 rounded-[20px] border border-live/50 bg-live/10 px-5 text-[13px] font-medium text-live shadow-[0_14px_32px_-16px_rgba(0,0,0,0.7)] backdrop-blur-xl transition-colors hover:bg-live/15"
          >
            <Stop size={12} weight="fill" aria-hidden />
            {t("common.stop")}
          </button>
        ) : (
          <button
            type="button"
            onClick={onRun}
            className="kun-btn-primary flex h-12 items-center gap-2 rounded-[20px] px-5 text-[13.5px] font-medium"
          >
            <Play size={12} weight="fill" aria-hidden />
            {t("common.run")}
            {runHint && (
              <span
                className="hidden border-s border-black/15 ps-2 font-mono text-[11px] font-normal opacity-70 md:inline"
                title={t("editor.play.runHintTitle")}
              >
                {runHint}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
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
      className={`flex h-9 items-center gap-2 rounded-xl px-2.5 text-[13px] transition-colors active:scale-[0.97] ${
        active
          ? "bg-ink/12 text-ink"
          : "text-muted hover:bg-ink/8 hover:text-ink"
      }`}
    >
      {icon}
      <span className="hidden lg:inline">{label}</span>
      <span className="sr-only lg:hidden">{label}</span>
    </button>
  );
}


function ProjectMenu({
  books,
  activeId,
  onOpen,
  onNew,
}: {
  books: Book[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const { t, ago } = useI18n();
  return (
    <div
      role="menu"
      className="kun-pop absolute start-0 top-full z-40 mt-3 w-72 overflow-hidden rounded-2xl border border-line2 bg-raised shadow-2xl shadow-black/40"
    >
      <p className="px-4 pb-1 pt-3 text-[12px] font-medium text-faint">{t("common.projects")}</p>
      <div className="max-h-72 overflow-auto px-1.5 pb-1.5">
        {books.map((b) => (
          <button
            key={b.id}
            type="button"
            role="menuitem"
            onClick={() => onOpen(b.id)}
            className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-start transition-colors hover:bg-ink/5 ${
              b.id === activeId ? "bg-ink/[0.07]" : ""
            }`}
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                b.id === activeId ? "bg-ink" : "bg-transparent"
              }`}
            />
            <span dir="auto" className="min-w-0 flex-1 truncate text-[13px] text-ink">
              {b.title || t("common.untitled")}
            </span>
            <span className="shrink-0 text-[11.5px] text-faint">{ago(b.updatedAt)}</span>
          </button>
        ))}
        {!books.length && (
          <p className="px-2.5 py-3 text-[13px] text-faint">{t("editor.play.nothingSaved")}</p>
        )}
      </div>
      <button
        type="button"
        role="menuitem"
        onClick={onNew}
        className="flex w-full items-center gap-2.5 border-t border-line px-4 py-3 text-start text-[13px] text-muted transition-colors hover:bg-ink/5 hover:text-ink"
      >
        <Plus size={14} weight="bold" aria-hidden />
        {t("editor.play.newProject")}
      </button>
    </div>
  );
}

/** Share and publish live in one menu so the bar carries one button for both. */
function ShareMenu({
  onShare,
  onPublish,
}: {
  onShare?: () => void;
  onPublish?: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item =
    "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-start transition-colors hover:bg-ink/5";
  return (
    <div ref={ref} className="relative">
      <BarButton
        onClick={() => setOpen((v) => !v)}
        label={t("common.share")}
        active={open}
        icon={<ShareNetwork size={16} aria-hidden />}
      />
      {open && (
        <div
          role="menu"
          className="kun-pop absolute end-0 top-full z-40 mt-3 w-72 rounded-2xl border border-line2 bg-raised p-1.5 shadow-2xl shadow-black/40"
        >
          {onShare && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onShare();
              }}
              className={item}
            >
              <Link2 size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden />
              <span>
                <span className="block text-[13px] font-medium text-ink">{t("editor.play.copyViewLink")}</span>
                <span className="block text-[12px] leading-snug text-muted">
                  {t("editor.play.copyViewLinkDesc")}
                </span>
              </span>
            </button>
          )}
          {onPublish && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onPublish();
              }}
              className={item}
            >
              <Export size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden />
              <span>
                <span className="block text-[13px] font-medium text-ink">{t("editor.play.publishTemplate")}</span>
                <span className="block text-[12px] leading-snug text-muted">
                  {t("editor.play.publishTemplateDesc")}
                </span>
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
