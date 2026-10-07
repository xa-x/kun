"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react";
import { NODE_TYPES } from "@/lib/nodes";
import { readJson } from "@/lib/http";
import { signInHref } from "@/lib/routes";
import { toast } from "./Toast";
import { BookCover } from "./workbooks/BookCover";
import type { TemplateMeta } from "./TemplateGallery";
import type { PortableWorkbook } from "@/lib/portable";

export function TemplateDetail({ slug }: { slug: string }) {
  const router = useRouter();
  const [item, setItem] = useState<
    (TemplateMeta & { workbook?: PortableWorkbook }) | null | undefined
  >(undefined);
  const [cloning, setCloning] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/templates/${encodeURIComponent(slug)}`)
      .then((r) =>
        readJson<{
          template?: TemplateMeta & { workbook?: PortableWorkbook };
        }>(r),
      )
      .then((j) => {
        if (alive) setItem(j.template ?? null);
      })
      .catch(() => {
        if (alive) setItem(null);
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  const clone = async () => {
    if (cloning || !item) return;
    setCloning(true);
    try {
      const res = await fetch(`/api/templates/${encodeURIComponent(slug)}/clone`, {
        method: "POST",
      });
      if (res.status === 401) {
        // Cloning creates a workbook, so send signed-out visitors through
        // sign-in and bring them back to this template.
        router.push(signInHref(`/templates/${slug}`));
        return;
      }
      const j = await readJson<{ graph?: { id: string }; error?: string }>(res);
      if (!res.ok || !j.graph?.id) throw new Error(j.error || "Clone failed");
      router.push(`/w/${j.graph.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn’t clone template.", "error");
      setCloning(false);
    }
  };

  const kinds = (item?.workbook?.nodes ?? []).map((n) => n.data.kind);
  const unique = [...new Set(kinds)];
  const counts = unique.map((k) => ({
    label: NODE_TYPES.find((d) => d.type === k)?.label ?? k,
    n: kinds.filter((x) => x === k).length,
  }));

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 md:px-10 md:py-12">
      <Link
        href="/templates"
        className="inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={13} weight="bold" aria-hidden />
        All templates
      </Link>

      {item === undefined && <div className="kun-skeleton mt-8 h-72" />}

      {item === null && (
        <div className="mt-8 rounded-2xl border border-dashed border-line2 px-6 py-16 text-center">
          <p className="text-[16px] font-medium text-ink">Template not found</p>
          <p className="mt-1 text-[13.5px] text-muted">
            It may have been unpublished.
          </p>
        </div>
      )}

      {item && (
        <div className="mt-8 grid gap-10 md:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <h1 className="text-[34px] font-semibold leading-[1.1] tracking-tight text-ink">
              {item.title}
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
              {item.description || "No description."}
            </p>
            {item.tags.length > 0 && (
              <ul className="mt-5 flex flex-wrap gap-1.5">
                {item.tags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-full border border-line px-2.5 py-0.5 text-[12.5px] text-muted"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => void clone()}
              disabled={cloning}
              className="kun-btn-primary mt-8 h-11 rounded-full px-6 text-[14px] font-medium disabled:opacity-60"
            >
              {cloning ? "Cloning…" : "Use this template"}
            </button>
            <p className="mt-3 text-[12.5px] text-faint">
              Cloned {item.cloneCount} {item.cloneCount === 1 ? "time" : "times"}.
              You get a private copy.
            </p>
          </div>

          <aside className="rounded-2xl border border-line bg-card/70">
            <div className="h-[150px] border-b border-line bg-sunken/70 p-4">
              <BookCover kinds={unique} />
            </div>
            <div className="p-5">
              <h2 className="text-[13.5px] font-medium text-ink">What is inside</h2>
              {counts.length ? (
                <ul className="mt-3 space-y-2">
                  {counts.map((c) => (
                    <li
                      key={c.label}
                      className="flex items-center justify-between text-[13px] text-muted"
                    >
                      {c.label}
                      <span className="font-mono tabular-nums text-ink">{c.n}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[13px] text-faint">No nodes.</p>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
