import { intlTag, type Locale } from "./i18n/config";

const USD_TINY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});
const USD_SMALL = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});
const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function fmtCost(micro: number) {
  if (!micro) return "—";
  return fmtUsd(micro / 1e6);
}

/** Format a dollar amount from provider usage (already in USD). */
export function fmtUsd(dollars?: number | null) {
  if (dollars == null || !Number.isFinite(dollars) || dollars <= 0) return "—";
  if (dollars < 0.01) return USD_TINY.format(dollars);
  if (dollars < 10) return USD_SMALL.format(dollars);
  return USD.format(dollars);
}

const DUR: Record<Locale, { ms: string; s: string; m: string }> = {
  en: { ms: "ms", s: "s", m: "m" },
  ar: { ms: " مللي ث", s: " ث", m: " د" },
};

export function fmtDur(ms?: number | null, locale: Locale = "en") {
  if (!ms && ms !== 0) return "—";
  const u = DUR[locale];
  if (ms < 1000) return `${ms}${u.ms}`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}${u.s}`;
  return `${Math.floor(ms / 60_000)}${u.m} ${Math.round((ms % 60_000) / 1000)}${u.s}`;
}

const rtfs = new Map<Locale, Intl.RelativeTimeFormat>();
function rtf(locale: Locale) {
  let f = rtfs.get(locale);
  if (!f) {
    f = new Intl.RelativeTimeFormat(intlTag(locale), { numeric: "always", style: "narrow" });
    rtfs.set(locale, f);
  }
  return f;
}

const NOW: Record<Locale, string> = { en: "just now", ar: "الآن" };
const SOON: Record<Locale, string> = { en: "any moment now", ar: "بعد لحظات" };

/** Relative time for a moment in the past, e.g. "5m ago". */
export function ago(t?: string | number, locale: Locale = "en") {
  if (!t) return "";
  const s = Math.max(0, (Date.now() - new Date(t).getTime()) / 1000);
  if (s < 60) return NOW[locale];
  if (s < 3600) return rtf(locale).format(-Math.floor(s / 60), "minute");
  if (s < 86400) return rtf(locale).format(-Math.floor(s / 3600), "hour");
  return rtf(locale).format(-Math.floor(s / 86400), "day");
}

/** Relative time for a moment in the future, e.g. "in 5 hr." */
export function until(t?: string | number | null, locale: Locale = "en") {
  if (!t) return "";
  const s = (new Date(t).getTime() - Date.now()) / 1000;
  if (s <= 60) return SOON[locale];
  if (s < 3600) return rtf(locale).format(Math.round(s / 60), "minute");
  if (s < 86400) return rtf(locale).format(Math.round(s / 3600), "hour");
  return rtf(locale).format(Math.round(s / 86400), "day");
}

export { GENERIC_VOICES as TTS_VOICES } from "./media-params";
