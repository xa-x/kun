"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { UploadSimple, X } from "@phosphor-icons/react";
import type { AssetKind } from "@/lib/assets";
import { toast } from "../Toast";
import { useI18n } from "@/lib/i18n";
import { kindLabel } from "./kind";
import { AssetFilterBar } from "./AssetFilters";
import { AssetGrid } from "./AssetGrid";
import { StockBrowser } from "./StockBrowser";
import { uploadAssets, useAssets, type AssetFilters } from "./use-assets";

export interface PickedAsset {
  id: string;
  kind: AssetKind;
}

/**
 * Choose a file from the workspace library, grab a free photo, or upload one.
 * `accept` limits what can be picked (a Video node only takes video).
 */
export function AssetPicker({
  accept,
  onPick,
  onClose,
}: {
  accept: AssetKind[];
  onPick: (a: PickedAsset) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"library" | "stock">("library");
  const [filters, setFilters] = useState<AssetFilters>({
    kind: accept.length === 1 ? accept[0] : null,
    source: null,
    q: "",
  });
  const [uploading, setUploading] = useState(false);
  const list = useAssets(filters, tab === "library");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const items = list.items?.filter((a) => accept.includes(a.kind)) ?? null;
  const canStock = accept.includes("image");

  const upload = async (files: File[]) => {
    setUploading(true);
    try {
      const [first] = await uploadAssets(files.slice(0, 1), (name) => t("shell.assets.uploadFile", { name }));
      if (!accept.includes(first.kind)) {
        toast(
          t("shell.assets.needs", { kinds: accept.map((k) => kindLabel(t, k)).join(t("shell.assets.or")) }),
          "error",
        );
        await list.reload();
        return;
      }
      onPick(first);
    } catch (e) {
      toast(e instanceof Error ? e.message : t("shell.assets.uploadFailed"), "error");
    } finally {
      setUploading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" aria-label={t("common.close")} onClick={onClose} className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-label={t("shell.assets.choose")}
        className="kun-pop relative flex max-h-[88dvh] w-full max-w-[860px] flex-col overflow-hidden rounded-t-3xl border border-line2 bg-card shadow-2xl sm:rounded-3xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 px-6 pb-3 pt-5">
          <div role="tablist" aria-label={t("shell.assets.whereFrom")} className="flex gap-1">
            {(
              [
                ["library", t("shell.assets.yourAssets")],
                ...(canStock ? ([["stock", t("shell.assets.freePhotos")]] as const) : []),
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`h-9 rounded-full px-4 text-[13px] transition-colors ${
                  tab === k ? "bg-ink/10 font-medium text-ink" : "text-muted hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="kun-btn-secondary inline-flex h-9 items-center gap-2 rounded-full px-4 text-[12.5px] font-medium disabled:opacity-60"
            >
              <UploadSimple size={14} weight="bold" aria-hidden />
              {uploading ? t("common.uploading") : t("common.upload")}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={accept.map((k) => `${k}/*`).join(",")}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload([f]);
                e.target.value = "";
              }}
            />
            <button type="button" onClick={onClose} aria-label={t("common.close")} className="flex h-9 w-9 items-center justify-center rounded-full text-faint hover:bg-ink/8 hover:text-ink">
              <X size={15} weight="bold" aria-hidden />
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-2">
          {tab === "library" ? (
            <>
              <AssetFilterBar value={filters} onChange={setFilters} kinds={accept} />
              <AssetGrid
                dense
                items={items}
                failed={list.failed}
                hasMore={list.hasMore}
                loadingMore={list.loadingMore}
                onMore={list.more}
                onOpen={(a) => onPick({ id: a.id, kind: a.kind })}
                empty={t("shell.assets.pickerEmpty")}
              />
            </>
          ) : (
            <StockBrowser onImported={(a) => onPick({ id: a.id, kind: "image" })} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
