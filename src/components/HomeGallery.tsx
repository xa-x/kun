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
import { ago, until } from "@/lib/format";
import { toast } from "./Toast";
import { readJson } from "@/lib/http";
import { useCreateWorkbook } from "@/lib/use-create-workbook";
import { PageHeader } from "./shell/PageHeader";
import { BookCover } from "./workbooks/BookCover";

export interface BookMeta {
  id: string;
  title: string;
  updatedAt?: string | number;
  createdAt?: string | number;
  nodeCount?: number;
  edgeCount?: number;
  kinds?: string[];
  lastRun?: {
    id: string;
    status: string;
    trigger: string;
    startedAt?: string | number;
    error?: string | null;
  } | null;
  nextRunAt?: string | number | null;
}

export function HomeGallery() {
  const router = useRouter();
  const { create, creating } = useCreateWorkbook();
  const [books, setBooks] = useState<BookMeta[] | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/graphs");
      const j = await readJson<{ graphs?: BookMeta[] }>(res);
      setBooks(Array.isArray(j?.graphs) ? j.graphs : []);
    } catch {
      toast("Couldn’t load workbooks.", "error");
      setBooks([]);
    }
  }, []);

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
      if (!res.ok) throw new Error("Rename failed");
      setBooks((xs) => (xs ?? []).map((b) => (b.id === id ? { ...b, title } : b)));
    } catch {
      toast("Couldn’t rename workbook.", "error");
    }
  };

  const duplicate = async (id: string) => {
    try {
      const res = await fetch(`/api/graphs/${id}/duplicate`, { method: "POST" });
      const j = await readJson<{ graph?: { id: string }; error?: string }>(res);
      if (!res.ok || !j.graph?.id) throw new Error(j.error || "Duplicate failed");
      router.push(`/w/${j.graph.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn’t duplicate.", "error");
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
      if (!res.ok || !j.graph?.id) throw new Error(j.error || "Import failed");
      router.push(`/w/${j.graph.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn’t import workbook.", "error");
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/graphs?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      setBooks((xs) => (xs ?? []).filter((b) => b.id !== id));
      toast("Workbook deleted.", "ok");
    } catch {
      toast("Couldn’t delete workbook.", "error");
    }
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!books || !q) return books;
    return books.filter((b) => (b.title || "Untitled").toLowerCase().includes(q));
  }, [books, query]);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 md:px-10 md:py-12">
      <PageHeader
        title="Workbooks"
        description="Pipelines of text, image, audio and video models. Build by hand, or describe the flow and let the assistant wire it."
        actions={
          <>
            <label className="kun-btn-secondary inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-[13px] font-medium">
              <UploadSimple size={15} weight="bold" aria-hidden />
              Import
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
            <button
              type="button"
              onClick={() => void create("ai")}
              disabled={!!creating}
              className="kun-btn-secondary inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-medium disabled:opacity-60"
            >
              <Sparkle size={15} weight="bold" aria-hidden />
              {creating === "ai" ? "Creating…" : "Create with AI"}
            </button>
            <button
              type="button"
              onClick={() => void create("blank")}
              disabled={!!creating}
              className="kun-btn-primary inline-flex h-10 items-center gap-2 rounded-full px-5 text-[13px] font-medium disabled:opacity-60"
            >
              <Plus size={15} weight="bold" aria-hidden />
              {creating === "blank" ? "Creating…" : "New workbook"}
            </button>
          </>
        }
      />

      {books && books.length > 6 && (
        <div className="relative mb-6 max-w-sm">
          <MagnifyingGlass
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
            aria-hidden
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search workbooks"
            aria-label="Search workbooks"
            className="kun-input !rounded-full pl-10"
          />
        </div>
      )}

      {shown === null && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="kun-skeleton h-[230px]" />
          ))}
        </div>
      )}

      {books && books.length === 0 && (
        <EmptyLibrary
          creating={creating}
          onBlank={() => void create("blank")}
          onAi={() => void create("ai")}
        />
      )}

      {books && books.length > 0 && shown && shown.length === 0 && (
        <p className="py-16 text-center text-[14px] text-muted">
          No workbook matches “{query}”.
        </p>
      )}

      {shown && shown.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((b) => (
            <li key={b.id}>
              <BookCard
                book={b}
                onRename={rename}
                onDelete={remove}
                onDuplicate={duplicate}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyLibrary({
  creating,
  onBlank,
  onAi,
}: {
  creating: "blank" | "ai" | null;
  onBlank: () => void;
  onAi: () => void;
}) {
  const options = [
    {
      title: "Describe it",
      body: "Tell the assistant what you want built and it wires the nodes for you.",
      action: creating === "ai" ? "Creating…" : "Create with AI",
      onClick: onAi,
      Icon: Sparkle,
    },
    {
      title: "Start from a canvas",
      body: "A text to AI text to output starter you can reshape in a minute.",
      action: creating === "blank" ? "Creating…" : "New workbook",
      onClick: onBlank,
      Icon: Plus,
    },
  ];
  return (
    <div className="rounded-2xl border border-dashed border-line2 bg-card/30 p-6 md:p-10">
      <h2 className="text-[20px] font-semibold tracking-tight text-ink">
        Make your first workbook
      </h2>
      <p className="mt-1.5 max-w-lg text-[14px] leading-relaxed text-muted">
        Nothing here yet. Pick a way in. You can always change the pipeline later.
      </p>
      <div className="mt-7 grid gap-3 md:grid-cols-3">
        {options.map(({ title, body, action, onClick, Icon }) => (
          <button
            key={title}
            type="button"
            onClick={onClick}
            disabled={!!creating}
            className="group rounded-2xl border border-line bg-card/70 p-5 text-left transition-colors hover:border-line2 disabled:opacity-60"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink/8 text-ink">
              <Icon size={17} weight="bold" aria-hidden />
            </span>
            <p className="mt-4 text-[15px] font-medium text-ink">{title}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">{body}</p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink">
              {action}
              <ArrowRight
                size={13}
                weight="bold"
                className="transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </span>
          </button>
        ))}
        <Link
          href="/templates"
          className="group rounded-2xl border border-line bg-card/70 p-5 transition-colors hover:border-line2"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink/8 text-ink">
            <Stack size={17} weight="bold" aria-hidden />
          </span>
          <p className="mt-4 text-[15px] font-medium text-ink">Borrow a template</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            Clone a published workbook and make it yours.
          </p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink">
            Browse templates
            <ArrowRight
              size={13}
              weight="bold"
              className="transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </Link>
      </div>
    </div>
  );
}

function runLabel(book: BookMeta) {
  const run = book.lastRun;
  if (!run) return { text: "Never run", tone: "bg-faint" };
  const when = ago(run.startedAt);
  if (run.status === "done" || run.status === "succeeded")
    return { text: `Ran ${when}`, tone: "bg-ok" };
  if (run.status === "error" || run.status === "failed")
    return { text: `Failed ${when}`, tone: "bg-err" };
  if (run.status === "running" || run.status === "queued")
    return { text: "Running now", tone: "bg-live" };
  return { text: `${run.status} ${when}`, tone: "bg-faint" };
}

function BookCard({
  book,
  onRename,
  onDelete,
  onDuplicate,
}: {
  book: BookMeta;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}) {
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
    const next = draft.trim().slice(0, 120) || "Untitled";
    setDraft(next);
    if (next !== book.title) onRename(book.id, next);
  };

  const run = runLabel(book);
  const href = `/w/${book.id}`;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-card/80 transition-colors hover:border-line2">
      <div className="relative h-[132px] border-b border-line bg-sunken/70 p-3">
        <BookCover kinds={book.kinds ?? []} />
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
              aria-label="Workbook title"
              className="kun-input !py-1.5 text-[15px] font-medium"
            />
          ) : (
            <h2 className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">
              {/* Stretched link: the whole card opens the canvas. */}
              <Link
                href={href}
                className="after:absolute after:inset-0 after:content-['']"
              >
                {book.title || "Untitled"}
              </Link>
            </h2>
          )}

          <div ref={menuRef} className="relative z-10 -mr-1.5 -mt-1 shrink-0">
            <button
              type="button"
              onClick={() => setMenu((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menu}
              aria-label={`Actions for ${book.title || "Untitled"}`}
              className="flex h-8 w-8 items-center justify-center rounded-full text-faint transition-colors hover:bg-ink/8 hover:text-ink focus-visible:text-ink"
            >
              <DotsThree size={20} weight="bold" aria-hidden />
            </button>
            {menu && (
              <div
                role="menu"
                className="kun-pop absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-line2 bg-raised p-1 shadow-2xl shadow-black/40"
              >
                <MenuItem
                  icon={<PencilSimple size={15} aria-hidden />}
                  onClick={() => {
                    setMenu(false);
                    setDraft(book.title);
                    setEditing(true);
                  }}
                >
                  Rename
                </MenuItem>
                <MenuItem
                  icon={<Copy size={15} aria-hidden />}
                  onClick={() => {
                    setMenu(false);
                    onDuplicate(book.id);
                  }}
                >
                  Duplicate
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
                  {confirm ? "Confirm delete" : "Delete"}
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
              {book.nodeCount} {book.nodeCount === 1 ? "node" : "nodes"}
            </>
          )}
        </p>
        {book.nextRunAt ? (
          <p className="mt-1 text-[12px] text-faint">
            Next scheduled run {until(book.nextRunAt)}
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
      className={`flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] transition-colors ${
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
