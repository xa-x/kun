import { intlTag, type Locale } from "./config";

export type Messages = Record<string, string>;
export type Vars = Record<string, string | number>;

/** Replace `{name}` placeholders. A placeholder with no value is left as written. */
export function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Look a message up, falling back to English, then to the key itself. */
export function translate(
  messages: Messages,
  fallback: Messages,
  key: string,
  vars?: Vars,
): string {
  return interpolate(messages[key] ?? fallback[key] ?? key, vars);
}

/**
 * Plural messages are stored as `base_one`, `base_other` (and for Arabic also
 * `_zero`, `_two`, `_few`, `_many`). `{n}` is filled in automatically.
 */
export function translatePlural(
  locale: Locale,
  messages: Messages,
  fallback: Messages,
  base: string,
  n: number,
  vars?: Vars,
): string {
  const rule = new Intl.PluralRules(intlTag(locale)).select(n);
  const pick = (m: Messages) => m[`${base}_${rule}`] ?? m[`${base}_other`];
  const template = pick(messages) ?? pick(fallback) ?? base;
  return interpolate(template, { n: n.toLocaleString(intlTag(locale)), ...vars });
}
