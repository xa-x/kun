"use client";

import { useEffect, useState } from "react";
import { DownloadSimple } from "@phosphor-icons/react";
import { useI18n } from "@/lib/i18n";
import { readJson } from "@/lib/http";
import { SHARE_DAY_CHOICES, type WorkspaceSettings as Settings } from "@/lib/workspace-settings";
import { toast } from "../Toast";
import { btnSecondary, Section, Toggle } from "./ui";

export function PrivacySettings() {
  const { t, tn } = useI18n();
  const [s, setS] = useState<Settings | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    let live = true;
    void fetch("/api/workspaces/settings")
      .then((r) => readJson<{ settings: Settings; canEdit: boolean }>(r))
      .then((j) => {
        if (!live) return;
        setS(j.settings);
        setCanEdit(j.canEdit);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const patch = async (change: Partial<Settings>) => {
    if (!s) return;
    const prev = s;
    setS({ ...s, ...change });
    try {
      const res = await fetch("/api/workspaces/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(change),
      });
      const j = await readJson<{ settings?: Settings; error?: string }>(res);
      if (!res.ok || !j.settings) throw new Error(j.error || t("settings.saveFailed"));
      setS(j.settings);
    } catch (e) {
      setS(prev);
      toast(e instanceof Error ? e.message : t("settings.saveFailed"), "error");
    }
  };

  if (!s) return <div className="kun-skeleton h-48" aria-busy />;

  return (
    <>
      <Section
        title={t("settings.privacy.sharing")}
        description={canEdit ? t("settings.privacy.sharingEdit") : t("settings.privacy.sharingView")}
      >
        <div className="divide-y divide-line">
          <Toggle
            label={t("settings.privacy.allowShares")}
            hint={t("settings.privacy.allowSharesHint")}
            checked={s.allowPublicShares}
            disabled={!canEdit}
            onChange={(v) => void patch({ allowPublicShares: v })}
          />
          <Toggle
            label={t("settings.privacy.allowPublish")}
            hint={t("settings.privacy.allowPublishHint")}
            checked={s.allowCommunityPublish}
            disabled={!canEdit}
            onChange={(v) => void patch({ allowCommunityPublish: v })}
          />
          <div className="flex items-start justify-between gap-6 py-3.5">
            <div>
              <label htmlFor="expiry" className="text-[13.5px] text-ink">
                {t("settings.privacy.expiry")}
              </label>
              <p className="mt-0.5 max-w-md text-[12.5px] leading-relaxed text-muted">{t("settings.privacy.expiryHint")}</p>
            </div>
            <select
              id="expiry"
              value={s.shareLinkDays ?? ""}
              disabled={!canEdit}
              onChange={(e) => void patch({ shareLinkDays: (e.target.value ? Number(e.target.value) : null) as Settings["shareLinkDays"] })}
              className="kun-input !h-10 !w-auto min-w-[130px] !text-[13px] disabled:opacity-50"
            >
              <option value="">{t("settings.privacy.never")}</option>
              {SHARE_DAY_CHOICES.map((d) => (
                <option key={d} value={d}>
                  {tn("settings.privacy.afterDays", d)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      <Section
        title={t("settings.privacy.data")}
        description={t("settings.privacy.dataDesc")}
      >
        <a href="/api/workspaces/export" className={btnSecondary}>
          <DownloadSimple size={15} aria-hidden />
          {t("settings.privacy.export")}
        </a>
        <p className="mt-2.5 max-w-md text-[12.5px] leading-relaxed text-faint">{t("settings.privacy.exportHint")}</p>
      </Section>

      <Section title={t("settings.privacy.handled")}>
        <ul className="max-w-xl space-y-2.5 text-[13px] leading-relaxed text-muted">
          <li>{t("settings.privacy.handled1")}</li>
          <li>{t("settings.privacy.handled2")}</li>
          <li>{t("settings.privacy.handled3")}</li>
        </ul>
      </Section>
    </>
  );
}
