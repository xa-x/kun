export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "kun_lang";

/** Names shown in the language picker, each in its own language. */
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", ar: "العربية" };

const RTL: Locale[] = ["ar"];
export const dirOf = (l: Locale): "ltr" | "rtl" => (RTL.includes(l) ? "rtl" : "ltr");

export const isLocale = (v: unknown): v is Locale => LOCALES.includes(v as Locale);

/**
 * BCP 47 tag for Intl. Arabic keeps Western digits (0-9): prices, run counts
 * and model names are read as numbers next to Latin identifiers.
 */
export const intlTag = (l: Locale) => (l === "ar" ? "ar-u-nu-latn" : "en");

/** Pick the best supported locale from an Accept-Language header. */
export function fromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const asked = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag.toLowerCase(), q: q ? Number(q) : 1 };
    })
    .filter((x) => x.tag && !Number.isNaN(x.q))
    .sort((a, b) => b.q - a.q);
  for (const { tag } of asked) {
    const base = tag.split("-")[0];
    const hit = LOCALES.find((l) => l === base);
    if (hit) return hit;
  }
  return DEFAULT_LOCALE;
}

/** The cookie wins; with none, the browser's own language decides. */
export function resolveLocale(cookie: string | undefined, acceptLanguage: string | null | undefined): Locale {
  return isLocale(cookie) ? cookie : fromAcceptLanguage(acceptLanguage);
}
