import { sql } from "drizzle-orm";
import { db } from "@/db";

/** Window "most used" looks back over, and how long a result is reused. */
const WINDOW_DAYS = 30;
const CACHE_MS = 5 * 60_000;

let cache: { at: number; counts: Map<string, number> } | null = null;

/**
 * Calls per model across the platform in the last 30 days, from the usage
 * ledger. Platform-wide on purpose: the shortlist is shared, so one org's
 * habits are not exposed to another, and a busy model is a good default.
 */
export async function recentModelUsage(): Promise<Map<string, number>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.counts;
  const rows = await db.execute<{ model: string; n: number }>(sql`
    select model, count(*)::int as n
    from usage_ledger
    where model is not null
      and created_at > now() - make_interval(days => ${WINDOW_DAYS})
    group by model
    order by n desc
    limit 300
  `);
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.model, Number(r.n));
  cache = { at: Date.now(), counts };
  return counts;
}
