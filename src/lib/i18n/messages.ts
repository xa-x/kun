import type { Locale } from "./config";
import { en } from "./dict/en";
import { ar } from "./dict/ar";
import type { Messages } from "./translate";

export type MessageKey = keyof typeof en;

/** Bases of plural messages: `x` for keys `x_one`, `x_other`, … */
export type PluralKey = {
  [K in MessageKey]: K extends `${infer B}_other` ? B : never;
}[MessageKey];

export const MESSAGES: Record<Locale, Messages> = { en, ar };
export const FALLBACK: Messages = en;
