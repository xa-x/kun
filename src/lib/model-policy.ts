import { eq } from "drizzle-orm";
import { db } from "@/db";
import { modelPolicy } from "@/db/schema";
import type { UsageInfo } from "./types";

/**
 * Admin model policy — enablement, pricing, and margin, all server-side.
 *
 * A model is user-visible (and runnable) only when enabled. Its cost basis
 * is the provider's own reported cost; the admin sets an optional override
 * (pricePerUsd, when OpenRouter's number is wrong or missing) plus a margin
 * percentage billed to the org. Billed cost is what the ledger, run
 * history, and plan limits all see.
 */

export interface ModelPolicyRow {
  model: string;
  enabled: boolean;
  /** Admin price override in USD per provider-reported unit; null = provider cost. */
  pricePerUsd: number | null;
  /** Markup percentage applied on top of the cost basis (0 = pass-through). */
  marginPct: number;
  /** Suggestion order from the dashboard; null = not pinned. */
  pinRank: number | null;
  updatedAt?: Date;
}

/** Policy cache — reread at most once a second per process. */
let cache: { at: number; rows: Map<string, ModelPolicyRow> } | null = null;
const CACHE_MS = 1000;

export async function policyMap(): Promise<Map<string, ModelPolicyRow>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rows;
  const rows = await db.select().from(modelPolicy);
  const map = new Map<string, ModelPolicyRow>();
  for (const r of rows) {
    map.set(r.model, {
      model: r.model,
      enabled: !!r.enabled,
      pricePerUsd: r.pricePerUsd == null ? null : r.pricePerUsd / 1e6,
      marginPct: r.marginPct,
      pinRank: r.pinRank ?? null,
      updatedAt: r.updatedAt,
    });
  }
  cache = { at: Date.now(), rows: map };
  return map;
}

export function invalidatePolicyCache() {
  cache = null;
}

export async function isModelEnabled(model: string): Promise<boolean> {
  if (!model) return true;
  const map = await policyMap();
  const row = map.get(model);
  return row ? row.enabled : true;
}

export async function enabledModels(): Promise<Set<string> | null> {
  const map = await policyMap();
  if (!map.size) return null; // no policy rows — everything enabled
  const out = new Set<string>();
  for (const [model, row] of map) if (row.enabled) out.add(model);
  return out;
}

/**
 * Billed USD for a model given the provider-reported cost. Applies the
 * admin price override first (it replaces the cost basis), then the margin
 * percentage. Missing policy passes through untouched.
 *
 * Some providers report no cost at all (image generation on OpenRouter does
 * not). Without a configured price that bills as free while the platform still
 * pays, so a price set for such a model acts as its flat per-call price.
 */
export async function billableCostUsd(
  model: string | undefined,
  costUsd: number | undefined,
): Promise<number | undefined> {
  if (!model) return costUsd;
  if (costUsd != null && !Number.isFinite(costUsd)) return costUsd;
  const map = await policyMap();
  const row = map.get(model);
  if (!row) return costUsd;
  const basis = row.pricePerUsd ?? costUsd;
  if (basis == null) return undefined; // nothing reported, nothing configured
  return basis * (1 + row.marginPct / 100);
}

/** Apply policy to a node's usage right after it finishes. */
export async function applyMargin(
  model: string | undefined,
  usage: UsageInfo | undefined,
): Promise<UsageInfo | undefined> {
  if (!usage) return usage;
  const billed = await billableCostUsd(model, usage.costUsd);
  if (billed === usage.costUsd) return usage;
  return { ...usage, costUsd: billed };
}

/** Upsert one model's policy (admin API). */
export async function setModelPolicy(input: {
  model: string;
  enabled?: boolean;
  pricePerUsd?: number | null;
  marginPct?: number;
  pinRank?: number | null;
}) {
  const [existing] = await db
    .select()
    .from(modelPolicy)
    .where(eq(modelPolicy.model, input.model))
    .limit(1);
  const enabled = input.enabled === undefined ? (existing?.enabled ?? true) : Boolean(input.enabled);
  const pricePerUsd =
    input.pricePerUsd === undefined
      ? (existing?.pricePerUsd ?? null)
      : input.pricePerUsd == null
        ? null
        : Math.round(input.pricePerUsd * 1e6);
  const marginPct = input.marginPct ?? existing?.marginPct ?? 0;
  const pinRank = input.pinRank === undefined ? (existing?.pinRank ?? null) : input.pinRank;
  if (existing) {
    await db
      .update(modelPolicy)
      .set({ enabled, pricePerUsd, marginPct, pinRank, updatedAt: new Date() })
      .where(eq(modelPolicy.model, input.model));
  } else {
    await db.insert(modelPolicy).values({ model: input.model, enabled, pricePerUsd, marginPct, pinRank });
  }
  invalidatePolicyCache();
}
