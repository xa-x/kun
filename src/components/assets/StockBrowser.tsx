"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, MagnifyingGlass, Spinner } from "@phosphor-icons/react";
import { readJson } from "@/lib/http";
import { toast } from "../Toast";
import { useI18n } from "@/lib/i18n";

interface Photo {
  id: string;
  thumb: string;
  alt: string;
  width: number;
  height: number;
  photographer: string;
  photographerUrl: string;
}

/**
 * Free photos from Unsplash. Choosing one saves it to the library with its
 * credit, then hands the new file back.
 */
export function StockBrowser({
  onImported,
}: {
  onImported: (a: { id: string; url: string; kind: "image" }) => void;
}) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const gen = useRef(0);

  useEffect(() => {
    const mine = ++gen.current;
    const timer = setTimeout(
      async () => {
        try {
          const res = await fetch(`/api/stock/search?q=${encodeURIComponent(q.trim())}&page=${page}`);
          const j = await readJson<{ configured?: boolean; photos?: Photo[]; totalPages?: number; error?: string }>(res);
          if (mine !== gen.current) return;
          if (!res.ok) throw new Error(j.error || t("shell.stock.unreachable"));
          setConfigured(j.configured !== false);
          setPhotos((prev) => (page > 1 ? [...(prev ?? []), ...(j.photos ?? [])] : (j.photos ?? [])));
          setPages(j.totalPages ?? 1);
          setErr(null);
        } catch (e) {
          if (mine === gen.current) {
            setErr(e instanceof Error ? e.message : t("shell.stock.unreachable"));
            setPhotos((p) => p ?? []);
          }
        }
      },
      q ? 300 : 0,
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, page]);

  const pick = async (p: Photo) => {
    setBusy(p.id);
    try {
      const res = await fetch("/api/stock/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: p.id }),
      });
      const j = await readJson<{ id?: string; url?: string; error?: string }>(res);
      if (!res.ok || !j.id || !j.url) throw new Error(j.error || t("shell.stock.saveFailed"));
      toast(t("shell.stock.saved"), "ok");
      onImported({ id: j.id, url: j.url, kind: "image" });
    } catch (e) {
      toast(e instanceof Error ? e.message : t("shell.stock.saveFailed"), "error");
    } finally {
      setBusy(null);
    }
  };

  if (!configured) {
    return (
      <div className="mx-auto max-w-md py-14 text-center">
        <p className="text-[15px] font-medium text-ink">{t("shell.stock.off")}</p>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          {t("shell.stock.offBefore")} <code dir="ltr" className="rounded bg-ink/8 px-1.5 py-0.5 font-mono text-[12px]">UNSPLASH_ACCESS_KEY</code>{" "}
          {t("shell.stock.offAfter")}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="relative mb-4 max-w-md">
        <MagnifyingGlass size={15} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder={t("shell.stock.search")}
          aria-label={t("shell.stock.search")}
          dir="auto"
          className="kun-input !rounded-full ps-10"
        />
      </div>
      {err && <p className="mb-3 text-[13px] text-err">{err}</p>}
      {photos === null ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="kun-skeleton aspect-[4/3]" />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <p className="py-12 text-center text-[13.5px] text-muted">{t("shell.stock.none", { query: q })}</p>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((p) => (
              <li key={p.id} className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-line bg-sunken">
                <button
                  type="button"
                  onClick={() => void pick(p)}
                  disabled={!!busy}
                  aria-label={t("shell.stock.use", { alt: p.alt })}
                  className="block h-full w-full active:scale-[0.99] disabled:opacity-70"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumb} alt={p.alt} loading="lazy" className="h-full w-full object-cover" />
                </button>
                {busy === p.id && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
                    <Spinner size={20} className="animate-spin" aria-hidden />
                  </span>
                )}
                <a
                  href={p.photographerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/75 to-transparent px-2.5 pb-1.5 pt-6 text-[11px] text-white/85 opacity-0 transition-opacity hover:text-white group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <span dir="auto" className="truncate">{p.photographer}</span>
                  <ArrowUpRight size={11} className="rtl-flip" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
          {page < pages && (
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => setPage((n) => n + 1)}
                className="kun-btn-secondary h-10 rounded-full px-5 text-[13px] font-medium"
              >
                {t("shell.assets.showMore")}
              </button>
            </div>
          )}
          <p className="mt-5 text-center text-[11.5px] text-faint">{t("shell.stock.credit")}</p>
        </>
      )}
    </div>
  );
}
