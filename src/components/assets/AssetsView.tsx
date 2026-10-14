"use client";

import { useRef, useState } from "react";
import { UploadSimple } from "@phosphor-icons/react";
import { PageHeader } from "../shell/PageHeader";
import { toast } from "../Toast";
import { useI18n } from "@/lib/i18n";
import { AssetFilterBar } from "./AssetFilters";
import { AssetGrid } from "./AssetGrid";
import { AssetPreview } from "./AssetPreview";
import { StockBrowser } from "./StockBrowser";
import { uploadAssets, useAssets, type Asset, type AssetFilters } from "./use-assets";

/** Everything the workspace has made or collected, in one place. */
export function AssetsView() {
  const { t, tn } = useI18n();
  const [tab, setTab] = useState<"library" | "stock">("library");
  const [filters, setFilters] = useState<AssetFilters>({ kind: null, source: null, q: "" });
  const [open, setOpen] = useState<Asset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const list = useAssets(filters, tab === "library");
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (files: File[]) => {
    const ok = files.filter((f) => /^(image|audio|video)\//.test(f.type));
    if (!ok.length) return toast(t("shell.assets.chooseMedia"), "error");
    setUploading(true);
    try {
      await uploadAssets(ok, (name) => t("shell.assets.uploadFile", { name }));
      toast(tn("shell.assets.uploaded", ok.length), "ok");
      await list.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("shell.assets.uploadFailed"), "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="relative mx-auto w-full max-w-6xl px-5 py-10 md:px-10 md:py-12"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void upload([...e.dataTransfer.files]);
      }}
    >
      <PageHeader
        title={t("shell.nav.assets")}
        description={t("shell.assets.description")}
        actions={
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="kun-btn-primary inline-flex h-10 items-center gap-2 rounded-full px-5 text-[13px] font-medium disabled:opacity-60"
            >
              <UploadSimple size={15} weight="bold" aria-hidden />
              {uploading ? t("common.uploading") : t("common.upload")}
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,audio/*,video/*"
              className="hidden"
              onChange={(e) => {
                void upload([...(e.target.files ?? [])]);
                e.target.value = "";
              }}
            />
          </>
        }
      />

      <div role="tablist" aria-label={t("shell.nav.assets")} className="mb-6 flex gap-1 border-b border-line">
        {(
          [
            ["library", t("shell.assets.yourFiles")],
            ["stock", t("shell.assets.freePhotos")],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`-mb-px h-10 border-b-2 px-4 text-[13.5px] transition-colors ${
              tab === k ? "border-ink font-medium text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "library" ? (
        <>
          <AssetFilterBar value={filters} onChange={setFilters} />
          <AssetGrid
            items={list.items}
            failed={list.failed}
            hasMore={list.hasMore}
            loadingMore={list.loadingMore}
            onMore={list.more}
            onOpen={setOpen}
            empty={
              filters.kind || filters.source || filters.q ? (
                t("shell.assets.noMatch")
              ) : (
                <>
                  {t("shell.assets.emptyBefore")}{" "}
                  <button type="button" onClick={() => setTab("stock")} className="text-ink underline underline-offset-2">
                    {t("shell.assets.freePhotos")}
                  </button>
                  {t("shell.assets.emptyAfter")}
                </>
              )
            }
          />
        </>
      ) : (
        <StockBrowser
          onImported={() => {
            void list.reload();
          }}
        />
      )}

      {open && (
        <AssetPreview
          asset={open}
          onClose={() => setOpen(null)}
          onRenamed={(id, name) => {
            list.rename(id, name);
            setOpen((a) => (a && a.id === id ? { ...a, name } : a));
          }}
          onDeleted={(id) => {
            list.remove(id);
            setOpen(null);
          }}
        />
      )}

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-canvas/80 backdrop-blur-sm">
          <p className="rounded-2xl border-2 border-dashed border-ink/50 px-10 py-8 text-[15px] text-ink">{t("shell.assets.drop")}</p>
        </div>
      )}
    </div>
  );
}
