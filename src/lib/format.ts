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

export function fmtDur(ms?: number | null) {
  if (!ms && ms !== 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

const rtf = new Intl.RelativeTimeFormat(undefined, {
  numeric: "always",
  style: "narrow",
});

export function ago(t?: string | number) {
  if (!t) return "";
  const s = Math.max(0, (Date.now() - new Date(t).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return rtf.format(-Math.floor(s / 60), "minute");
  if (s < 86400) return rtf.format(-Math.floor(s / 3600), "hour");
  return rtf.format(-Math.floor(s / 86400), "day");
}

/** Relative time for a moment in the future, e.g. "in 5 hr." */
export function until(t?: string | number | null) {
  if (!t) return "";
  const s = (new Date(t).getTime() - Date.now()) / 1000;
  if (s <= 60) return "any moment now";
  if (s < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (s < 86400) return rtf.format(Math.round(s / 3600), "hour");
  return rtf.format(Math.round(s / 86400), "day");
}

export { GENERIC_VOICES as TTS_VOICES } from "./media-params";
