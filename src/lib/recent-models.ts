/**
 * Recently used models — the personal alternative to the curated
 * "Suggested" lists. Recorded when a model is picked in a node or completes
 * a successful run, kept per node kind (an image model is no default for a
 * text node), and cached in localStorage so it survives reloads.
 */

import {
  filterModels,
  liveList,
  pickDefaultModel,
  type ModelInfo,
  type NodeModelKind,
} from "./models";

export interface RecentModel {
  id: string;
  /** Gateway the id belongs to; absent means OpenRouter. */
  provider?: string;
  /** Display name captured when it was picked, for ids later retired. */
  label?: string;
}

type RecentModels = Record<string, RecentModel[]>;

const KEY = "kun.recent-models.v1";
const CAP = 6;
/** Dispatched on window whenever the store changes. */
export const RECENT_EVENT = "kun:recent-models";

/**
 * Move an entry to the front, dropping the older copy — recency is the
 * whole point. Fields the new record omits (e.g. a run-success record has
 * no label) inherit the previous entry's, so a pick is never forgotten
 * just because a run updated the ordering.
 */
export function mergeRecent(
  list: RecentModel[] | undefined,
  next: RecentModel,
  cap = CAP,
): RecentModel[] {
  const prev = list ?? [];
  const old = prev.find((m) => m.id === next.id);
  return [
    {
      id: next.id,
      provider: next.provider ?? old?.provider,
      label: next.label ?? old?.label,
    },
    ...prev.filter((m) => m.id !== next.id),
  ].slice(0, cap);
}

function readAll(): RecentModels {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as RecentModels;
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    /* ignore */
  }
  return {};
}

export function recentsFor(kind: string): RecentModel[] {
  const list = readAll()[kind];
  return Array.isArray(list) ? list.filter((m) => typeof m?.id === "string") : [];
}

export function recordRecent(kind: string, model: RecentModel) {
  if (typeof window === "undefined" || !kind || !model.id) return;
  const all = readAll();
  all[kind] = mergeRecent(all[kind], model);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new CustomEvent(RECENT_EVENT));
}

/**
 * The model a new node should start on: the most recent one still served
 * by its provider, then the curated suggestions, then any live model.
 * A gateway recent counts only while that gateway is configured and still
 * lists the id; an OpenRouter recent only while OpenRouter's live list (or
 * absence of one) can't disprove it.
 */
export function pickRecentDefault(
  recents: RecentModel[],
  suggested: { id: string }[],
  models: Record<string, ModelInfo[]>,
  errors: Record<string, string> | undefined,
  kind: NodeModelKind,
): { model: string; provider?: string } {
  const live = liveList(models, errors);
  const liveForKind = live ? filterModels(live, kind) : null;

  const usable = (r: RecentModel): boolean => {
    if (!r.provider || r.provider === "openrouter")
      return liveForKind ? liveForKind.some((m) => m.id === r.id) : true;
    if (errors?.[r.provider]) return true; // gateway unreachable — can't verify
    const gw = models[r.provider];
    return !!gw?.length && filterModels(gw, kind).some((m) => m.id === r.id);
  };

  for (const r of recents) {
    if (!usable(r)) continue;
    return {
      model: r.id,
      provider:
        r.provider && r.provider !== "openrouter" ? r.provider : undefined,
    };
  }
  return { model: pickDefaultModel(suggested, liveForKind) };
}
