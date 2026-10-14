/**
 * Cron expressions for schedules. Pure (no database), so the browser can show
 * "next run" while you type. Times are UTC.
 */
import type { MessageKey, PluralKey } from "./i18n/messages";
import type { Vars } from "./i18n/translate";

/** Minimal 5-field cron: m h dom mon dow. Supports * and N. */
export function nextCron(expr: string, from = new Date()): Date {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error("Cron must be 5 fields: m h dom mon dow");
  const [min, hour, dom, mon, dow] = parts.map(parseField);
  const d = new Date(from.getTime());
  d.setUTCSeconds(0, 0);
  d.setUTCMinutes(d.getUTCMinutes() + 1);
  for (let i = 0; i < 366 * 24 * 60; i++) {
    if (
      matchField(min, d.getUTCMinutes()) &&
      matchField(hour, d.getUTCHours()) &&
      matchField(dom, d.getUTCDate()) &&
      matchField(mon, d.getUTCMonth() + 1) &&
      matchField(dow, d.getUTCDay())
    ) {
      return d;
    }
    d.setUTCMinutes(d.getUTCMinutes() + 1);
  }
  throw new Error("Could not resolve next cron time");
}

function parseField(field: string): number[] | null {
  if (field === "*") return null;
  return field.split(",").flatMap((part) => {
    if (part.includes("/")) {
      const [range, stepS] = part.split("/");
      const step = Number(stepS);
      const [a, b] = range === "*" ? [0, 59] : range.split("-").map(Number);
      const out: number[] = [];
      for (let n = a; n <= b; n += step) out.push(n);
      return out;
    }
    if (part.includes("-")) {
      const [a, b] = part.split("-").map(Number);
      const out: number[] = [];
      for (let n = a; n <= b; n++) out.push(n);
      return out;
    }
    return [Number(part)];
  });
}

function matchField(allowed: number[] | null, value: number) {
  return !allowed || allowed.includes(value);
}

/** Ready-made schedules for the common cases. Times are UTC. `key` is the message that words it. */
export const CRON_PRESETS = [
  { label: "Every hour", key: "editor.cron.hourly", expr: "0 * * * *" },
  { label: "Every day at 09:00", key: "editor.cron.daily", expr: "0 9 * * *" },
  { label: "Weekdays at 09:00", key: "editor.cron.weekdays", expr: "0 9 * * 1-5" },
  { label: "Every Monday at 09:00", key: "editor.cron.monday", expr: "0 9 * * 1" },
] as const satisfies readonly { label: string; key: MessageKey; expr: string }[];

/** The translators `describeCron` uses to word a schedule; without them it answers in English. */
export interface CronWords {
  t: (key: MessageKey, vars?: Vars) => string;
  tn: (base: PluralKey, n: number, vars?: Vars) => string;
}

/** A cron expression in words, or the expression itself when it has none. */
export function describeCron(expr: string, words?: CronWords): string {
  const e = expr.trim().replace(/\s+/g, " ");
  const preset = CRON_PRESETS.find((p) => p.expr === e);
  if (preset) return words ? words.t(preset.key) : preset.label;
  const every = e.match(/^\*\/(\d+) \* \* \* \*$/);
  if (every) return words ? words.tn("editor.cron.everyMinutes", Number(every[1])) : `Every ${every[1]} minutes`;
  const daily = e.match(/^(\d+) (\d+) \* \* \*$/);
  if (daily) {
    const time = `${daily[2].padStart(2, "0")}:${daily[1].padStart(2, "0")}`;
    return words ? words.t("editor.cron.dailyAt", { time }) : `Every day at ${time}`;
  }
  return e;
}

/** The next run for `expr`, or an error message a person can read. */
export function previewCron(
  expr: string,
  from = new Date(),
): { next: Date } | { error: string } {
  try {
    return { next: nextCron(expr, from) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not a valid schedule" };
  }
}
