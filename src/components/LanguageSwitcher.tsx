"use client";

import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_COOKIE, LOCALE_NAMES, isLocale } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n";

/**
 * Pick the interface language. The choice is a cookie the server reads, so
 * everything, including the page's direction, switches on the next render.
 */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const router = useRouter();
  const { locale, t } = useI18n();
  return (
    <>
      <label htmlFor="lang" className="sr-only">
        {t("common.language")}
      </label>
      <select
        id="lang"
        value={locale}
        onChange={(e) => {
          if (!isLocale(e.target.value)) return;
          document.cookie = `${LOCALE_COOKIE}=${e.target.value}; path=/; max-age=31536000; samesite=lax`;
          router.refresh();
        }}
        className={`kun-input !h-10 !w-auto min-w-[140px] !text-[13px] ${className}`}
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </>
  );
}
