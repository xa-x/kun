"use client";

import { MusicNotes, Play } from "@phosphor-icons/react";
import { useI18n } from "@/lib/i18n";
import { kindLabel } from "./kind";
import type { Asset } from "./use-assets";

/** A file at a glance: the picture, a still of the video, or a sound icon. */
export function AssetTile({
  asset,
  onOpen,
  selected = false,
}: {
  asset: Asset;
  onOpen: (a: Asset) => void;
  selected?: boolean;
}) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={() => onOpen(asset)}
      aria-label={`${asset.name}, ${kindLabel(t, asset.kind)}`}
      aria-pressed={selected}
      className={`group relative block aspect-square w-full overflow-hidden rounded-xl border bg-sunken text-start transition-[border-color,transform] active:scale-[0.98] ${
        selected ? "border-ink" : "border-line hover:border-line2"
      }`}
    >
      {asset.kind === "image" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={asset.url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      )}
      {asset.kind === "video" && (
        <>
          <video
            src={`${asset.url}#t=0.1`}
            muted
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
          />
          <span className="absolute start-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur">
            <Play size={11} weight="fill" aria-hidden />
          </span>
        </>
      )}
      {asset.kind === "audio" && (
        <span className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_30%_20%,rgba(255,140,100,0.16),transparent_60%)] text-[#e6967a]">
          <MusicNotes size={26} weight="duotone" aria-hidden />
        </span>
      )}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-2 pt-6 text-[11.5px] leading-tight text-white/90 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        <span dir="auto" className="line-clamp-1">{asset.name}</span>
      </span>
    </button>
  );
}
