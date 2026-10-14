"use client";

import { Images } from "@phosphor-icons/react";
import { useI18n } from "@/lib/i18n";
import { AssetTile } from "./AssetTile";
import type { Asset } from "./use-assets";

/** The tiles, with their loading, empty and error states. */
export function AssetGrid({
  items,
  failed,
  hasMore,
  loadingMore,
  onMore,
  onOpen,
  empty,
  dense = false,
}: {
  items: Asset[] | null;
  failed: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onMore: () => void;
  onOpen: (a: Asset) => void;
  empty: React.ReactNode;
  dense?: boolean;
}) {
  const { t } = useI18n();
  const cols = dense
    ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5"
    : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
  if (failed && !items) return <p className="py-14 text-center text-[13.5px] text-muted">{t("shell.assets.loadFailed")}</p>;
  if (!items)
    return (
      <div className={`grid gap-3 ${cols}`} aria-busy>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="kun-skeleton aspect-square" />
        ))}
      </div>
    );
  if (!items.length)
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center py-14 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink/8 text-ink">
          <Images size={22} aria-hidden />
        </span>
        <div className="mt-4 text-[13.5px] leading-relaxed text-muted">{empty}</div>
      </div>
    );
  return (
    <>
      <ul className={`grid gap-3 ${cols}`}>
        {items.map((a) => (
          <li key={a.id}>
            <AssetTile asset={a} onOpen={onOpen} />
          </li>
        ))}
      </ul>
      {hasMore && (
        <div className="mt-6 text-center">
          <button type="button" onClick={onMore} disabled={loadingMore} className="kun-btn-secondary h-10 rounded-full px-5 text-[13px] font-medium disabled:opacity-60">
            {loadingMore ? t("common.loading") : t("shell.assets.showMore")}
          </button>
        </div>
      )}
    </>
  );
}
