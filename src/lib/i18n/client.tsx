"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { dirOf, intlTag, type Locale } from "./config";
import { ago, fmtDur, until } from "../format";
import type { MessageKey, PluralKey } from "./messages";
import { translate, translatePlural, type Messages, type Vars } from "./translate";

interface Ctx {
  locale: Locale;
  messages: Messages;
  fallback: Messages;
}

const I18nContext = createContext<Ctx | null>(null);

/**
 * Carries the active locale's messages to client components. English is sent
 * along only as the fallback for a key not yet translated.
 */
export function I18nProvider({
  locale,
  messages,
  fallback,
  children,
}: Ctx & { children: ReactNode }) {
  const value = useMemo(() => ({ locale, messages, fallback }), [locale, messages, fallback]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** `t("shell.workspace")`, `tn("shell.projects", 3)`, plus the locale, direction and number formatter. */
export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n needs <I18nProvider>");
  const { locale, messages, fallback } = ctx;
  const t = useCallback(
    (key: MessageKey, vars?: Vars) => translate(messages, fallback, key, vars),
    [messages, fallback],
  );
  const tn = useCallback(
    (base: PluralKey, n: number, vars?: Vars) => translatePlural(locale, messages, fallback, base, n, vars),
    [locale, messages, fallback],
  );
  return useMemo(
    () => ({
      t,
      tn,
      locale,
      dir: dirOf(locale),
      /** Relative times in this language: "5m ago", "in 2 hr". */
      ago: (t?: string | number) => ago(t, locale),
      until: (t?: string | number | null) => until(t, locale),
      /** A duration in this language: "1.2s", "1.2 ث". */
      dur: (ms?: number | null) => fmtDur(ms, locale),
      /** Format a date for this language. */
      date: (d: Date | string | number, opts?: Intl.DateTimeFormatOptions) =>
        new Date(d).toLocaleDateString(intlTag(locale), opts),
      /** Format a number for this language. */
      num: (n: number, opts?: Intl.NumberFormatOptions) => n.toLocaleString(intlTag(locale), opts),
    }),
    [t, tn, locale],
  );
}

export const useT = () => useI18n().t;
