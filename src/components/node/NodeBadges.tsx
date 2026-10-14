"use client";

import { useI18n } from "@/lib/i18n";
import { PushPin, Snowflake } from "@phosphor-icons/react";

/**
 * Marks for a node kept as it is (frozen) or handed back as the project's
 * result (returned). Shown beside the title, quiet until they matter.
 */
export function NodeBadges({
  frozen,
  pinned,
}: {
  frozen?: boolean;
  pinned?: boolean;
}) {
  const { t } = useI18n();
  if (!frozen && !pinned) return null;
  return (
    <span className="flex shrink-0 items-center gap-1">
      {frozen && (
        <span
          title={t("canvas.badge.frozenTip")}
          className="flex h-5 w-5 items-center justify-center rounded-full bg-live/15 text-live"
        >
          <Snowflake size={11} weight="bold" aria-label={t("canvas.badge.frozen")} />
        </span>
      )}
      {pinned && (
        <span
          title={t("canvas.badge.returnedTip")}
          className="flex h-5 w-5 items-center justify-center rounded-full bg-ink/10 text-ink"
        >
          <PushPin size={11} weight="fill" aria-label={t("canvas.badge.returned")} />
        </span>
      )}
    </span>
  );
}
