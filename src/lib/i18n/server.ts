import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, dirOf, resolveLocale, type Locale } from "./config";
import { FALLBACK, MESSAGES, type MessageKey, type PluralKey } from "./messages";
import { translate, translatePlural, type Vars } from "./translate";

/** The visitor's locale: their saved choice, else their browser's language. */
export async function getLocale(): Promise<Locale> {
  const [c, h] = await Promise.all([cookies(), headers()]);
  return resolveLocale(c.get(LOCALE_COOKIE)?.value, h.get("accept-language"));
}

/** Translators for server components. */
export async function getT() {
  const locale = await getLocale();
  const messages = MESSAGES[locale];
  return {
    locale,
    dir: dirOf(locale),
    t: (key: MessageKey, vars?: Vars) => translate(messages, FALLBACK, key, vars),
    tn: (base: PluralKey, n: number, vars?: Vars) =>
      translatePlural(locale, messages, FALLBACK, base, n, vars),
  };
}
