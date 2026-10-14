"use client";

import { useEffect, useState } from "react";
import { readJson } from "@/lib/http";
import { useSignOut } from "@/lib/use-sign-out";
import type { ThemePref } from "@/lib/theme";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { useTheme } from "../ThemeProvider";
import { toast } from "../Toast";
import { btnPrimary, btnSecondary, inputCls, Section } from "./ui";

const THEMES: { value: ThemePref; label: MessageKey }[] = [
  { value: "system", label: "settings.appearance.system" },
  { value: "light", label: "settings.appearance.light" },
  { value: "dark", label: "settings.appearance.dark" },
];

export function ProfileSettings() {
  const { t } = useI18n();
  const theme = useTheme();
  const { signOut, busy } = useSignOut();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    void fetch("/api/auth/session")
      .then((r) => readJson<{ user?: { email: string; name?: string | null } | null }>(r))
      .then((j) => {
        if (!live || !j.user) return;
        setEmail(j.user.email);
        setName(j.user.name ?? "");
        setSaved(j.user.name ?? "");
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const j = await readJson<{ name?: string; error?: string }>(res);
      if (!res.ok) throw new Error(j.error || t("settings.saveFailed"));
      setSaved(j.name ?? name);
      toast(t("settings.profile.nameSaved"), "ok");
    } catch (e) {
      toast(e instanceof Error ? e.message : t("settings.saveFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Section title={t("settings.profile.title")} description={t("settings.profile.desc")}>
        <form
          className="max-w-sm space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div>
            <label htmlFor="pname" className="mb-1.5 block text-[13px] font-medium text-ink">
              {t("settings.profile.name")}
            </label>
            <input id="pname" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} dir="auto" className={inputCls} />
          </div>
          <div>
            <label htmlFor="pmail" className="mb-1.5 block text-[13px] font-medium text-ink">
              {t("settings.profile.email")}
            </label>
            <input id="pmail" value={email} readOnly dir="ltr" className={`${inputCls} text-start opacity-70`} />
            <p className="mt-1.5 text-[12.5px] text-faint">{t("settings.profile.emailHint")}</p>
          </div>
          <button type="submit" disabled={saving || !name.trim() || name.trim() === saved} className={btnPrimary}>
            {saving ? t("common.saving") : t("settings.profile.saveName")}
          </button>
        </form>
      </Section>

      <Section title={t("settings.appearance.title")} description={t("settings.appearance.desc")}>
        <div role="radiogroup" aria-label={t("settings.appearance.theme")} className="inline-flex gap-1 rounded-full border border-line p-1">
          {THEMES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme.pref === value}
              onClick={() => theme.setPref(value)}
              className={`h-8 rounded-full px-4 text-[13px] transition-colors ${
                theme.pref === value ? "bg-ink font-medium text-canvas" : "text-muted hover:text-ink"
              }`}
            >
              {t(label)}
            </button>
          ))}
        </div>
      </Section>

      <Section title={t("settings.language.title")} description={t("settings.language.desc")}>
        <LanguageSwitcher />
      </Section>

      <Section title={t("settings.session.title")}>
        <button type="button" onClick={signOut} disabled={busy} className={btnSecondary}>
          {busy ? t("settings.session.signingOut") : t("common.signOut")}
        </button>
      </Section>
    </>
  );
}
