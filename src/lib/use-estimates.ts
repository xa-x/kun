"use client";

import { useEffect, useState } from "react";
import { readJson } from "./http";
import { useI18n } from "./i18n";
import type { MessageKey } from "./i18n/messages";
import type { Vars } from "./i18n/translate";

type T = (key: MessageKey, vars?: Vars) => string;

export interface Estimate {
  costUsd: number;
  durationMs: number;
  samples: number;
}

const TTL_MS = 5 * 60_000;
const cache = new Map<string, { at: number; value: Estimate | null }>();
const wanted = new Set<string>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

/** Nodes ask for their model one by one; one request answers them all. */
function flush() {
  timer = null;
  const models = [...wanted];
  wanted.clear();
  if (!models.length) return;
  fetch(`/api/estimates?models=${encodeURIComponent(models.join(","))}`)
    .then((r) => readJson<{ estimates?: Record<string, Estimate> }>(r))
    .then((j) => {
      for (const m of models) {
        cache.set(m, { at: Date.now(), value: j.estimates?.[m] ?? null });
      }
    })
    .catch(() => {
      // A missing estimate is not worth an error; try again after the TTL.
      for (const m of models) cache.set(m, { at: Date.now(), value: null });
    })
    .finally(() => listeners.forEach((l) => l()));
}

/** What is known right now, without asking the server. */
export function peekEstimate(model?: string): Estimate | null {
  return (model && cache.get(model)?.value) || null;
}

/** Make sure every model has been looked up, then resolve. Never rejects. */
export async function loadEstimates(models: string[]): Promise<void> {
  const need = [
    ...new Set(
      models.filter((m) => {
        const hit = cache.get(m);
        return m && !(hit && Date.now() - hit.at < TTL_MS);
      }),
    ),
  ];
  if (!need.length) return;
  try {
    const j = await fetch(`/api/estimates?models=${encodeURIComponent(need.join(","))}`).then(
      (r) => readJson<{ estimates?: Record<string, Estimate> }>(r),
    );
    for (const m of need) cache.set(m, { at: Date.now(), value: j.estimates?.[m] ?? null });
  } catch {
    for (const m of need) cache.set(m, { at: Date.now(), value: null });
  }
  listeners.forEach((l) => l());
}

/** What `model` typically costs and how long it takes, or null while unknown. */
export function useEstimate(model?: string): Estimate | null {
  const [, bump] = useState(0);
  useEffect(() => {
    const on = () => bump((n) => n + 1);
    listeners.add(on);
    return () => void listeners.delete(on);
  }, []);
  useEffect(() => {
    if (!model) return;
    const hit = cache.get(model);
    if (hit && Date.now() - hit.at < TTL_MS) return;
    wanted.add(model);
    timer ??= setTimeout(flush, 60);
  }, [model]);
  return (model && cache.get(model)?.value) || null;
}

/**
 * "~$0.93 · ~5 min": the fields that exist, worded for a node header. Pass the
 * translator from `useI18n()` to word the time in the active language.
 */
export function formatEstimate(e: Estimate, t?: T): string {
  const cost = e.costUsd >= 0.01 ? `$${e.costUsd.toFixed(2)}` : `$${e.costUsd.toFixed(4)}`;
  const s = e.durationMs / 1000;
  let time = "";
  if (s) {
    if (s < 90) {
      const n = Math.max(1, Math.round(s));
      time = t ? t("editor.estimate.sec", { n }) : `${n}s`;
    } else {
      const n = Math.round(s / 60);
      time = t ? t("editor.estimate.min", { n }) : `${n} min`;
    }
  }
  return time ? `~${cost} · ~${time}` : `~${cost}`;
}

/** `formatEstimate` bound to the active language. */
export function useFormatEstimate(): (e: Estimate) => string {
  const { t } = useI18n();
  return (e) => formatEstimate(e, t);
}
