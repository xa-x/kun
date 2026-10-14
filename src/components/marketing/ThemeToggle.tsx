"use client";

import { Desktop, Moon, Sun } from "@phosphor-icons/react";
import { useTheme } from "../ThemeProvider";
import type { ThemePref } from "@/lib/theme";
import { useI18n, type MessageKey } from "@/lib/i18n";

const OPTIONS: { value: ThemePref; label: MessageKey; Icon: typeof Sun }[] = [
  { value: "system", label: "site.theme.system", Icon: Desktop },
  { value: "light", label: "site.theme.light", Icon: Sun },
  { value: "dark", label: "site.theme.dark", Icon: Moon },
];

export function ThemeToggle() {
  const { pref, setPref } = useTheme();
  const { t } = useI18n();
  return (
    <div
      role="radiogroup"
      aria-label={t("site.theme.label")}
      className="inline-flex items-center gap-0.5 rounded-full border border-line p-0.5"
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={pref === value}
          aria-label={t(label)}
          title={t(label)}
          onClick={() => setPref(value)}
          className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
            pref === value
              ? "bg-ink/12 text-ink"
              : "text-faint hover:text-ink"
          }`}
        >
          <Icon size={14} weight={pref === value ? "fill" : "regular"} aria-hidden />
        </button>
      ))}
    </div>
  );
}
