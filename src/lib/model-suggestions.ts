import {
  modelFits,
  PROVIDER_LABELS,
  providerOf,
  type ModelInfo,
  type NodeModelKind,
} from "./models";

/** Why a model is suggested: an admin pinned it, people use it, or it is new. */
export type SuggestSource = "pinned" | "popular" | "new" | "curated";

export type Suggestion = ModelInfo & { source: SuggestSource };

/** How many suggestions a picker shows, and how many may come from usage. */
export const SUGGESTION_LIMIT = 6;
const POPULAR_SHARE = 3;

/**
 * The "Suggested" shortlist for one node kind, built from the live catalog so
 * it never offers a retired model:
 *
 * 1. models an admin pinned, in pin order — the dashboard override;
 * 2. the most-used models on the platform (calls over the recent window);
 * 3. the newest model from each vendor, to fill what is left and to surface
 *    launches before anyone has used them.
 *
 * Media kinds put a curated list of known-good models ahead of step 3: every
 * image, video and text-to-speech vendor wants different parameters (voice,
 * audio format, first frame), so a model nobody has run is likely to fail.
 * Speech fills from the curated list only.
 *
 * Step 3 only considers vendors the app names (PROVIDER_LABELS) and skips
 * variants (`:batch`), previews and alias ids (`~`): the catalog holds
 * hundreds of one-off vendors that make poor defaults. An admin or the usage
 * data can still put any of them forward.
 */
export function buildSuggestions(opts: {
  live: ModelInfo[];
  kind: NodeModelKind;
  /** model id -> pin rank (lower first). */
  pins: ReadonlyMap<string, number>;
  /** model id -> recent call count. */
  usage: ReadonlyMap<string, number>;
  /** Models known to work for this kind (image, video, speech). */
  curated?: readonly string[];
  limit?: number;
}): Suggestion[] {
  const { kind, pins, usage, limit = SUGGESTION_LIMIT } = opts;
  const pool = opts.live.filter((m) => modelFits(m, kind));
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  const take = (m: ModelInfo, source: SuggestSource) => {
    if (seen.has(m.id) || out.length >= limit) return;
    seen.add(m.id);
    out.push({ ...m, source });
  };

  pool
    .filter((m) => pins.has(m.id))
    .sort((a, b) => pins.get(a.id)! - pins.get(b.id)! || a.id.localeCompare(b.id))
    .forEach((m) => take(m, "pinned"));

  let popular = 0;
  pool
    .filter((m) => (usage.get(m.id) ?? 0) > 0)
    .sort((a, b) => usage.get(b.id)! - usage.get(a.id)! || a.id.localeCompare(b.id))
    .forEach((m) => {
      if (popular >= POPULAR_SHARE || seen.has(m.id)) return;
      take(m, "popular");
      popular++;
    });

  // Image, video and speech models differ in what they accept, so models that
  // have actually run here come before ones nobody has tried. Speech stops
  // there; image and video then add the newest from known vendors.
  for (const id of opts.curated ?? []) {
    const m = pool.find((x) => x.id === id);
    if (m) take(m, "curated");
  }
  if (kind === "audio") return out;

  const vendors = new Set(out.map((m) => providerOf(m.id)));
  pool
    .filter(
      (m) =>
        !m.id.includes(":") &&
        !m.id.startsWith("~") &&
        !/preview|exp(erimental)?\b/i.test(m.id) &&
        providerOf(m.id) in PROVIDER_LABELS,
    )
    .sort((a, b) => (b.created ?? 0) - (a.created ?? 0) || a.id.localeCompare(b.id))
    .forEach((m) => {
      const vendor = providerOf(m.id);
      if (vendors.has(vendor)) return;
      vendors.add(vendor);
      take(m, "new");
    });

  return out;
}
