"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import type { AssetKind, AssetSource } from "@/lib/assets";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n/messages";
import type { AssetFilters } from "./use-assets";

const KINDS: { v: AssetKind | null; label: MessageKey }[] = [
  { v: null, label: "common.all" },
  { v: "image", label: "shell.assets.kind.images" },
  { v: "video", label: "common.video" },
  { v: "audio", label: "common.audio" },
];
const SOURCES: { v: AssetSource | null; label: MessageKey }[] = [
  { v: null, label: "shell.assets.source.anywhere" },
  { v: "generated", label: "shell.assets.source.generated" },
  { v: "upload", label: "shell.assets.source.upload" },
  { v: "stock", label: "shell.assets.source.stock" },
];

function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`h-8 rounded-full border px-3.5 text-[12.5px] transition-colors active:scale-[0.97] ${
        on ? "border-ink/50 bg-ink/10 text-ink" : "border-line text-muted hover:border-line2 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/** Search plus kind and source chips. `lockKind` hides kinds a picker can't take. */
export function AssetFilterBar({
  value,
  onChange,
  kinds,
}: {
  value: AssetFilters;
  onChange: (f: AssetFilters) => void;
  /** Kinds on offer (all when omitted). */
  kinds?: AssetKind[];
}) {
  const { t } = useI18n();
  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-3">
      <div className="relative w-full max-w-[260px]">
        <MagnifyingGlass size={15} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
        <input
          value={value.q}
          onChange={(e) => onChange({ ...value, q: e.target.value })}
          placeholder={t("shell.assets.searchName")}
          aria-label={t("shell.assets.searchFiles")}
          dir="auto"
          className="kun-input !h-9 !rounded-full ps-10 !text-[13px]"
        />
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("shell.assets.type")}>
        {KINDS.filter((k) => !k.v || !kinds || kinds.includes(k.v)).map((k) => (
          <Chip key={k.label} on={value.kind === k.v} onClick={() => onChange({ ...value, kind: k.v })}>
            {t(k.label)}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("shell.assets.source")}>
        {SOURCES.map((s) => (
          <Chip key={s.label} on={value.source === s.v} onClick={() => onChange({ ...value, source: s.v })}>
            {t(s.label)}
          </Chip>
        ))}
      </div>
    </div>
  );
}
