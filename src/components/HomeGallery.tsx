"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Copy,
  DotsThree,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Sparkle,
  Stack,
  Trash,
  UploadSimple,
} from "@phosphor-icons/react";
import { toast } from "./Toast";
import { readJson } from "@/lib/http";
import { useCreateWorkbook } from "@/lib/use-create-workbook";
import { WorkspaceBadge } from "./shell/WorkspaceSwitcher";
import { HomeRail } from "./home/HomeRail";
import { BookCover } from "./workbooks/BookCover";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages";

export interface BookMeta {
  id: string;
  title: string;
  updatedAt?: string | number;
  createdAt?: string | number;
  nodeCount?: number;
  edgeCount?: number;
  kinds?: string[];
  coverId?: string | null;
  lastRun?: {
    id: string;
    status: string;
    trigger: string;
    startedAt?: string | number;
    error?: string | null;
  } | null;
  nextRunAt?: string | number | null;
}

export function HomeGallery({ name, workspace }: { name: string; workspace: { id: string; name: string } }) {
  const router = useRouter();
  const { t, tn } = useI18n();
  const { create, creating } = useCreateWorkbook();
  const [books, setBooks] = useState<BookMeta[] | null>(null);
  const [query, setQuery] = useState("");
  const [hello, setHello] = useState<MessageKey>("shell.home.hello.welcome");
  useEffect(() => {
    const h = new Date().getHours();
    const timer = setTimeout(
      () =>
        setHello(
          h < 5
            ? "shell.home.hello.late"
            : h < 12
              ? "shell.home.hello.morning"
              : h < 18
                ? "shell.home.hello.afternoon"
                : "shell.home.hello.evening",
        ),
      0,
    );
    return () => clearTimeout(timer);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/graphs");
      const j = await readJson<{ graphs?: BookMeta[] }>(res);
      setBooks(Array.isArray(j?.graphs) ? j.graphs : []);
    } catch {
      toast(t("shell.home.loadFailed"), "error");
      setBooks([]);
    }
  }, [t]);

  useEffect(() => {
    const t = setTimeout(() => load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const rename = async (id: string, title: string) => {
    try {
      const res = await fetch("/api/graphs", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, title }),
      });
      if (!res.ok) throw new Error("rename");
      setBooks((xs) => (xs ?? []).map((b) => (b.id === id ? { ...b, title } : b)));
    } catch {
      toast(t("shell.home.renameFailed"), "error");
    }
  };

  const duplicate = async (id: string) => {
    try {
      const res = await fetch(`/api/graphs/${id}/duplicate`, { method: "POST" });
      const j = await readJson<{ graph?: { id: string }; error?: string }>(res);
      if (!res.ok || !j.graph?.id) throw new Error(j.error || t("shell.home.duplicateFailed"));
      router.push(`/w/${j.graph.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : t("shell.home.duplicateFailed"), "error");
    }
  };

  const importFile = async (file: File) => {
    try {
      const pack = JSON.parse(await file.text());
      const res = await fetch("/api/graphs/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(pack),
      });
      const j = await readJson<{ graph?: { id: string }; error?: string }>(res);
      if (!res.ok || !j.graph?.id) throw new Error(j.error || t("shell.home.importFailed"));
      router.push(`/w/${j.graph.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : t("shell.home.importFailed"), "error");
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/graphs?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("delete");
      setBooks((xs) => (xs ?? []).filter((b) => b.id !== id));
      toast(t("shell.home.deleted"), "ok");
    } catch {
      toast(t("shell.home.deleteFailed"), "error");
    }
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!books || !q) return books;
    return books.filter((b) => (b.title || t("common.untitled")).toLowerCase().includes(q));
  }, [books, query, t]);

  const recent = books && books.length > 3 ? books.slice(0, 3) : [];
  const rest =
    recent.length > 0 && !query.trim() ? (shown ?? []).filter((b) => !recent.includes(b)) : shown;
  const first = name.trim().split(/\s+/)[0] || t("shell.home.there");

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-10 md:px-10 md:py-12">
      <header className="mb-9 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 items-center gap-4">
          <WorkspaceBadge id={workspace.id} name={workspace.name} size={48} />
          <div className="min-w-0">
            <h1 className="truncate text-[28px] font-semibold leading-tight tracking-tight text-ink">
              {t("shell.home.greeting", { hello: t(hello), name: first })}
            </h1>
            <p className="mt-0.5 truncate text-[14px] text-muted">
              <bdi>{workspace.name}</bdi>
              {books ? ` · ${tn("shell.home.projects", books.length)}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="kun-btn-secondary inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-[13px] font-medium">
            <UploadSimple size={15} weight="bold" aria-hidden />
            {t("shell.home.import")}
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importFile(f);
                e.target.value = "";
              }}
            />
          </label>
          {books?.length !== 0 && (
            <button
              type="button"
              onClick={() => void create("blank")}
              disabled={!!creating}
              className="kun-btn-primary inline-flex h-10 items-center gap-2 rounded-full px-5 text-[13px] font-medium disabled:opacity-60"
            >
              <Plus size={15} weight="bold" aria-hidden />
              {creating === "blank" ? t("common.creating") : t("shell.nav.newProject")}
            </button>
          )}
        </div>
      </header>

      <div className="grid gap-12 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {books && books.length > 0 && (
            <Composer creating={creating} onAi={(p) => void create("ai", p)} />
          )}

          {shown === null && (
            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="kun-skeleton h-[230px]" />
              ))}
            </div>
          )}

          {books && books.length === 0 && (
            <EmptyLibrary
              creating={creating}
              onBlank={() => void create("blank")}
              onAi={(p) => void create("ai", p)}
            />
          )}

          {recent.length > 0 && !query.trim() && (
            <section aria-label={t("shell.home.jumpBack")} className="mb-10">
              <h2 className="mb-3 text-[12px] font-medium uppercase tracking-[0.12em] text-faint">{t("shell.home.jumpBack")}</h2>
              <ul className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                {recent.map((b) => (
                  <li key={b.id}>
                    <BookCard book={b} tall onRename={rename} onDelete={remove} onDuplicate={duplicate} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {books && books.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[12px] font-medium uppercase tracking-[0.12em] text-faint">
                {recent.length > 0 && !query.trim() ? t("shell.home.earlier") : t("shell.home.allProjects")}
              </h2>
              {books.length > 6 && (
                <div className="relative w-full max-w-[240px]">
                  <MagnifyingGlass
                    size={15}
                    className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-faint"
                    aria-hidden
                  />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("shell.home.search")}
                    aria-label={t("shell.home.search")}
                    dir="auto"
                    className="kun-input !h-9 !rounded-full ps-10 !text-[13px]"
                  />
                </div>
              )}
            </div>
          )}

          {books && books.length > 0 && shown && shown.length === 0 && (
            <p className="py-16 text-center text-[14px] text-muted">{t("shell.home.noMatch", { query })}</p>
          )}

          {rest && rest.length > 0 && (
            <ul className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {rest.map((b) => (
                <li key={b.id}>
                  <BookCard book={b} onRename={rename} onDelete={remove} onDuplicate={duplicate} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside aria-label={t("shell.home.around")} className="xl:sticky xl:top-8 xl:self-start">
          <HomeRail />
        </aside>
      </div>
    </div>
  );
}

/** A one-line way to start something new, once the page has projects. */
function Composer({
  creating,
  onAi,
}: {
  creating: "blank" | "ai" | null;
  onAi: (prompt: string) => void;
}) {
  const { t } = useI18n();
  const [prompt, setPrompt] = useState("");
  const ready = prompt.trim().length > 0 && !creating;
  return (
    <form
      className="mb-10 flex items-center gap-2 rounded-2xl border border-line2 bg-card/60 p-2 ps-5 transition-colors focus-within:border-ink/40"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onAi(prompt);
      }}
    >
      <Sparkle size={16} weight="fill" className="shrink-0 text-faint" aria-hidden />
      <label htmlFor="compose" className="sr-only">
        {t("shell.home.whatMake")}
      </label>
      <input
        id="compose"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        maxLength={600}
        placeholder={t("shell.home.composerPlaceholder")}
        dir="auto"
        className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-ink outline-none placeholder:text-faint"
      />
      <button
        type="submit"
        disabled={!ready}
        className="kun-btn-primary inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-5 text-[13px] font-medium disabled:opacity-50"
      >
        {creating === "ai" ? t("common.creating") : t("shell.home.build")}
      </button>
    </form>
  );
}

const IDEAS: MessageKey[] = [
  "shell.home.idea1",
  "shell.home.idea2",
  "shell.home.idea3",
];

/**
 * First run. One question, "what do you want to make?", answered in the
 * page: the prompt goes to the assistant on the new project. The other ways
 * in sit beside it as plain rows, not three equal cards.
 */
function EmptyLibrary({
  creating,
  onBlank,
  onAi,
}: {
  creating: "blank" | "ai" | null;
  onBlank: () => void;
  onAi: (prompt: string) => void;
}) {
  const { t } = useI18n();
  const [prompt, setPrompt] = useState("");
  const ready = prompt.trim().length > 0 && !creating;
  const submit = () => ready && onAi(prompt);

  return (
    <div className="grid gap-10 md:grid-cols-[1.7fr_1fr] md:gap-14">
      <section aria-labelledby="first-project">
        <h2
          id="first-project"
          className="text-[22px] font-semibold leading-tight tracking-tight text-ink"
        >
          {t("shell.home.whatMake")}
        </h2>
        <p className="mt-1.5 max-w-md text-[14px] leading-relaxed text-muted">
          {t("shell.home.describeHelp")}
        </p>

        <div className="mt-6 rounded-2xl border border-line2 bg-card/60 p-3 transition-colors focus-within:border-ink/40">
          <label htmlFor="first-prompt" className="sr-only">
            {t("shell.home.describeLabel")}
          </label>
          <textarea
            id="first-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
            rows={4}
            maxLength={600}
            placeholder={t("shell.home.firstPlaceholder")}
            dir="auto"
            className="w-full resize-none bg-transparent px-2 py-1.5 text-[15px] leading-relaxed text-ink outline-none placeholder:text-faint"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
            <div className="flex flex-wrap gap-1.5">
              {IDEAS.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  onClick={() => setPrompt(t(idea))}
                  className="rounded-full border border-line px-3 py-1 text-[12px] text-muted transition-colors hover:border-line2 hover:text-ink active:scale-[0.98]"
                >
                  {t(idea)}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={!ready}
              className="kun-btn-primary inline-flex h-10 items-center gap-2 rounded-full px-5 text-[13px] font-medium disabled:opacity-50"
            >
              <Sparkle size={15} weight="bold" aria-hidden />
              {creating === "ai" ? t("common.creating") : t("shell.home.build")}
            </button>
          </div>
        </div>
      </section>

      <section aria-label={t("shell.home.otherWays")}>
        <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-faint">
          {t("shell.home.startFrom")}
        </p>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          <StartRow
            onClick={onBlank}
            disabled={!!creating}
            Icon={Plus}
            title={creating === "blank" ? t("common.creating") : t("shell.home.blank")}
            body={t("shell.home.blankBody")}
          />
          <StartRow
            href="/community"
            Icon={Stack}
            title={t("shell.home.template")}
            body={t("shell.home.templateBody")}
          />
        </ul>
      </section>
    </div>
  );
}

function StartRow({
  title,
  body,
  Icon,
  onClick,
  href,
  disabled,
}: {
  title: string;
  body: string;
  Icon: typeof Plus;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}) {
  const inner = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink/8 text-ink">
        <Icon size={16} weight="bold" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium text-ink">{title}</span>
        <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">
          {body}
        </span>
      </span>
      <ArrowRight
        size={14}
        weight="bold"
        className="rtl-flip shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink rtl:group-hover:-translate-x-0.5"
        aria-hidden
      />
    </>
  );
  const cls =
    "group flex w-full items-center gap-3 py-3.5 text-start transition-colors hover:bg-ink/[0.03] active:scale-[0.995] disabled:opacity-60";
  return (
    <li>
      {href ? (
        <Link href={href} className={cls}>
          {inner}
        </Link>
      ) : (
        <button type="button" onClick={onClick} disabled={disabled} className={cls}>
          {inner}
        </button>
      )}
    </li>
  );
}

function runLabel(
  book: BookMeta,
  t: (key: MessageKey, vars?: Record<string, string | number>) => string,
  ago: (t?: string | number) => string,
) {
  const run = book.lastRun;
  if (!run) return { text: t("shell.home.neverRun"), tone: "bg-faint" };
  const when = ago(run.startedAt);
  if (run.status === "done" || run.status === "succeeded")
    return { text: t("shell.home.ran", { when }), tone: "bg-ok" };
  if (run.status === "error" || run.status === "failed")
    return { text: t("shell.home.failedAt", { when }), tone: "bg-err" };
  if (run.status === "running" || run.status === "queued")
    return { text: t("shell.home.runningNow"), tone: "bg-live" };
  return { text: `${run.status} ${when}`, tone: "bg-faint" };
}

function BookCard({
  book,
  tall = false,
  onRename,
  onDelete,
  onDuplicate,
}: {
  book: BookMeta;
  tall?: boolean;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}) {
  const { t, tn, ago, until } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(book.title);
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenu(false);
        setConfirm(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        setConfirm(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim().slice(0, 120) || t("common.untitled");
    setDraft(next);
    if (next !== book.title) onRename(book.id, next);
  };

  const run = runLabel(book, t, ago);
  const href = `/w/${book.id}`;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-card/80 transition-colors hover:border-line2">
      <div
        className={`relative border-b border-line bg-sunken/70 ${tall ? "h-[168px]" : "h-[132px]"} ${book.coverId ? "" : "p-3"}`}
      >
        {book.coverId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/media/${book.coverId}`} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <BookCover kinds={book.kinds ?? []} />
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start gap-2">
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") {
                  setDraft(book.title);
                  setEditing(false);
                }
              }}
              aria-label={t("shell.home.projectTitle")}
              dir="auto"
              className="kun-input !py-1.5 text-[15px] font-medium"
            />
          ) : (
            <h2 className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">
              {/* Stretched link: the whole card opens the canvas. */}
              <Link
                href={href}
                dir="auto"
                className="after:absolute after:inset-0 after:content-['']"
              >
                {book.title || t("common.untitled")}
              </Link>
            </h2>
          )}

          <div ref={menuRef} className="relative z-10 -me-1.5 -mt-1 shrink-0">
            <button
              type="button"
              onClick={() => setMenu((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menu}
              aria-label={t("shell.home.actionsFor", { title: book.title || t("common.untitled") })}
              className="flex h-8 w-8 items-center justify-center rounded-full text-faint transition-colors hover:bg-ink/8 hover:text-ink focus-visible:text-ink"
            >
              <DotsThree size={20} weight="bold" aria-hidden />
            </button>
            {menu && (
              <div
                role="menu"
                className="kun-pop absolute end-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-line2 bg-raised p-1 shadow-2xl shadow-black/40"
              >
                <MenuItem
                  icon={<PencilSimple size={15} aria-hidden />}
                  onClick={() => {
                    setMenu(false);
                    setDraft(book.title);
                    setEditing(true);
                  }}
                >
                  {t("common.rename")}
                </MenuItem>
                <MenuItem
                  icon={<Copy size={15} aria-hidden />}
                  onClick={() => {
                    setMenu(false);
                    onDuplicate(book.id);
                  }}
                >
                  {t("common.duplicate")}
                </MenuItem>
                <MenuItem
                  danger
                  icon={<Trash size={15} aria-hidden />}
                  onClick={() => {
                    if (!confirm) {
                      setConfirm(true);
                      return;
                    }
                    setMenu(false);
                    setConfirm(false);
                    onDelete(book.id);
                  }}
                >
                  {confirm ? t("shell.home.confirmDelete") : t("common.delete")}
                </MenuItem>
              </div>
            )}
          </div>
        </div>

        <p className="mt-1 flex items-center gap-2 text-[12.5px] text-muted">
          <span className={`h-1.5 w-1.5 rounded-full ${run.tone}`} aria-hidden />
          {run.text}
          {typeof book.nodeCount === "number" && (
            <>
              <span className="text-faint" aria-hidden>
                /
              </span>
              {tn("shell.home.nodes", book.nodeCount)}
            </>
          )}
        </p>
        {book.nextRunAt ? (
          <p className="mt-1 text-[12px] text-faint">
            {t("shell.home.nextRun", { when: until(book.nextRunAt) })}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function MenuItem({
  icon,
  danger = false,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-start text-[13px] transition-colors ${
        danger
          ? "text-muted hover:bg-err/10 hover:text-err"
          : "text-muted hover:bg-ink/5 hover:text-ink"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
