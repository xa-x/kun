import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { runNodes } from "@/db/schema";
import { fail, requireActor } from "@/lib/auth";

export const runtime = "nodejs";

const WINDOW_DAYS = 60;
const MAX_MODELS = 24;

/**
 * GET /api/estimates?models=a,b — what each model typically costs and how long
 * it takes, from finished node runs on this platform (median of the last 60
 * days). OpenRouter publishes no price for video models and only per-token
 * figures for others, so history is the one source that covers every kind.
 * Only aggregates leave the server, never another workspace's runs.
 */
export async function GET(req: NextRequest) {
  try {
    await requireActor(req);
    const models = [
      ...new Set(
        (req.nextUrl.searchParams.get("models") ?? "")
          .split(",")
          .map((m) => m.trim())
          .filter((m) => m && m.length <= 120),
      ),
    ].slice(0, MAX_MODELS);
    if (!models.length) return NextResponse.json({ estimates: {} });

    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
    const rows = await db
      .select({
        model: runNodes.model,
        samples: sql<number>`count(*)::int`,
        costMicro: sql<number>`percentile_cont(0.5) within group (order by ${runNodes.costUsd})::float`,
        durationMs: sql<number>`coalesce(percentile_cont(0.5) within group (order by ${runNodes.durationMs}), 0)::float`,
      })
      .from(runNodes)
      .where(
        and(
          inArray(runNodes.model, models),
          eq(runNodes.status, "done"),
          gt(runNodes.costUsd, 0),
          gte(runNodes.createdAt, since),
        ),
      )
      .groupBy(runNodes.model);

    const estimates: Record<string, { costUsd: number; durationMs: number; samples: number }> = {};
    for (const r of rows) {
      if (!r.model) continue;
      estimates[r.model] = {
        costUsd: r.costMicro / 1e6,
        durationMs: Math.round(r.durationMs),
        samples: r.samples,
      };
    }
    return NextResponse.json({ estimates });
  } catch (e) {
    return fail(e);
  }
}
