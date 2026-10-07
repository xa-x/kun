"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MagnifyingGlass, Star } from "@phosphor-icons/react";
import { ago } from "@/lib/format";
import { readJson } from "@/lib/http";
import { signInHref } from "@/lib/routes";
import { toast } from "./Toast";

export interface TemplateMeta {
  id: string;
  slug: string;
  title: string;
  description: string;
  tags: string[];
  cloneCount: number;
  featured: boolean;
  createdAt?: string | number;
}

export function TemplateGallery() {
  const router = useRouter();
  const [items, setItems] = useState<TemplateMeta[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [cloning, setCloning] = useState<string | null>(null);

  const load = useCallback(async (query = "") => {
    try {
      const res = await fetch(
        `/api/templates${query ? `?q=${encodeURIComponent(query)}` : ""}`,
      );
      if (!res.ok) throw new Error("Request failed");
      const j = await readJson<{ templates?: TemplateMeta[] }>(res);
      setFailed(false);
      setItems(j.templates ?? []);
    } catch {
      setFailed(true);
      setItems([]);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(q), q ? 200 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const clone = async (slug: string) => {
    if (cloning) return;
    setCloning(slug);
    try {
      const res = await fetch(`/api/templates/${encodeURIComponent(slug)}/clone`, {
        method: "POST",
      });
      if (res.status === 401) {
        // Cloning creates a workbook, so send signed-out visitors through
        // sign-in and bring them back to the gallery.
        router.push(signInHref("/templates"));
        return;
      }
      const j = await readJson<{ graph?: { id: string }; error?: string }>(res);
      if (!res.ok || !j.graph?.id) throw new Error(j.error || "Clone failed");
      router.push(`/w/${j.graph.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn’t clone template.", "error");
      setCloning(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 md:px-10 md:py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-ink">
            Templates
          </h1>
          <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-muted">
            Published workbooks anyone can clone. Skills travel with the
            snapshot; uploaded media does not.
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <MagnifyingGlass
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
            aria-hidden
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search templates"
            aria-label="Search templates"
            className="kun-input !rounded-full pl-10"
          />
        </div>
      </div>

      {items === null && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="kun-skeleton h-[200px]" />
          ))}
        </div>
      )}

      {items && items.length === 0 && failed && (
        <div className="rounded-2xl border border-dashed border-line2 bg-card/30 px-6 py-16 text-center">
          <p className="text-[16px] font-medium text-ink">
            Couldn’t load templates
          </p>
          <p className="mx-auto mt-1 max-w-sm text-[13.5px] leading-relaxed text-muted">
            Something went wrong reaching the gallery. Check your connection
            and try again.
          </p>
          <button
            type="button"
            onClick={() => {
              setItems(null);
              void load(q);
            }}
            className="kun-btn-secondary mt-6 h-10 rounded-full px-5 text-[13px] font-medium"
          >
            Try again
          </button>
        </div>
      )}

      {items && items.length === 0 && !failed && (
        <div className="rounded-2xl border border-dashed border-line2 bg-card/30 px-6 py-16 text-center">
          <p className="text-[16px] font-medium text-ink">
            {q ? `No template matches “${q}”` : "No templates yet"}
          </p>
          <p className="mx-auto mt-1 max-w-sm text-[13.5px] leading-relaxed text-muted">
            {q
              ? "Try a shorter search."
              : "Open a workbook and use Publish to share it here."}
          </p>
        </div>
      )}

      {items && items.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((t) => (
            <li key={t.id}>
              <article className="group relative flex h-full flex-col rounded-2xl border border-line bg-card/70 p-5 transition-colors hover:border-line2">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 text-[16px] font-medium leading-snug text-ink">
                    <Link
                      href={`/templates/${t.slug}`}
                      className="after:absolute after:inset-0 after:content-['']"
                    >
                      {t.title}
                    </Link>
                  </h2>
                  {t.featured && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warn/15 px-2 py-0.5 text-[11.5px] font-medium text-warn">
                      <Star size={11} weight="fill" aria-hidden />
                      Featured
                    </span>
                  )}
                </div>
                <p className="mt-2 line-clamp-3 text-[13.5px] leading-relaxed text-muted">
                  {t.description || "No description."}
                </p>
                {t.tags.length > 0 && (
                  <ul className="mt-4 flex flex-wrap gap-1.5">
                    {t.tags.slice(0, 4).map((tag) => (
                      <li
                        key={tag}
                        className="rounded-full border border-line px-2.5 py-0.5 text-[12px] text-muted"
                      >
                        {tag}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="relative z-10 mt-auto flex items-center justify-between pt-5">
                  <span className="text-[12.5px] text-faint">
                    {t.cloneCount} {t.cloneCount === 1 ? "clone" : "clones"}
                    {t.createdAt ? `, ${ago(t.createdAt)}` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => void clone(t.slug)}
                    disabled={!!cloning}
                    className="kun-btn-primary h-9 rounded-full px-4 text-[13px] font-medium disabled:opacity-60"
                  >
                    {cloning === t.slug ? "Cloning…" : "Use template"}
                  </button>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
